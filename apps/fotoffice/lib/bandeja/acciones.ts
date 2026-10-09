import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { MENSAJES_BANDEJA, puedeOperarBandeja, puedeVerBandeja, type CtxBandeja } from "./acceso";
import { leerConexion } from "./conexion";
import { TEXTO_MAXIMO } from "./constantes";
import { enviarTexto, type ResultadoEnvio } from "./envio";
import {
  alDevolver,
  alResolver,
  alResponderDesdePanel,
  alTomar,
  puedeResponderLibre,
  type EstadoChat,
  type ResultadoRegla,
} from "./reglas";
import { clienteDelTelefono, detalleDeError } from "./registro";

/**
 * Acciones de la Bandeja de WhatsApp (servidor). Todas reciben el contexto armado desde la sesión
 * (`contextoDeBandeja`): el `workspaceId` y el usuario NUNCA vienen del navegador. Cada chat se busca
 * por `id` Y `workspaceId`. Las que modifican un chat toman el mismo candado de fila que el registro
 * del webhook (`FOR UPDATE`) y releen el chat ya con sus cambios antes de aplicar las reglas.
 * Nunca loguean textos ni teléfonos.
 */

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

type Tx = Prisma.TransactionClient;
type ChatFila = NonNullable<Awaited<ReturnType<Tx["fotofficeWaChat"]["findFirst"]>>>;

const no = (error: string): { ok: false; error: string } => ({ ok: false, error });

const aEstado = (c: ChatFila): EstadoChat => ({
  estado: c.estado as EstadoChat["estado"],
  asignadoUserId: c.asignadoUserId,
  botPausadoHasta: c.botPausadoHasta,
  ultimoEntranteEn: c.ultimoEntranteEn,
});

/** El chat del workspace, con la fila bloqueada y releída. `null` si no existe en este workspace. */
async function chatBloqueado(tx: Tx, workspaceId: string, chatId: string): Promise<ChatFila | null> {
  const chat = await tx.fotofficeWaChat.findFirst({ where: { id: chatId, workspaceId } });
  if (!chat) return null;
  await tx.$executeRaw`SELECT 1 FROM "FotofficeWaChat" WHERE id = ${chat.id} FOR UPDATE`;
  return (await tx.fotofficeWaChat.findFirst({ where: { id: chatId, workspaceId } })) ?? chat;
}

async function escribirSistema(tx: Tx, workspaceId: string, chatId: string, texto: string, createdAt: Date) {
  await tx.fotofficeWaMensaje.create({
    data: { workspaceId, chatId, direccion: "SISTEMA", autor: "SISTEMA", tipo: "TEXTO", texto, createdAt },
  });
}

/** Aplica una regla de transición (tomar, devolver, resolver) con candado y deja el SISTEMA. */
async function transicion(
  ctx: CtxBandeja,
  chatId: string,
  regla: (chat: ChatFila) => ResultadoRegla | null,
  ahora: Date,
): Promise<Resultado> {
  if (!puedeOperarBandeja(ctx)) return no(MENSAJES_BANDEJA.sinPermiso);
  try {
    return await prisma.$transaction(async (tx): Promise<Resultado> => {
      const chat = await chatBloqueado(tx, ctx.workspaceId, chatId);
      if (!chat) return no(MENSAJES_BANDEJA.noExiste);
      const r = regla(chat);
      if (!r) return { ok: true }; // ya estaba así: nada que contar
      await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: r.parche });
      if (r.sistema) await escribirSistema(tx, ctx.workspaceId, chat.id, r.sistema.texto, ahora);
      return { ok: true };
    });
  } catch (e) {
    console.error("[fotoffice][whatsapp] falló una acción de la bandeja", detalleDeError(e));
    return no(MENSAJES_BANDEJA.fallo);
  }
}

type Deps = { ahora?: Date; enviar?: typeof enviarTexto };

export async function tomar(ctx: CtxBandeja, chatId: string, deps: Deps = {}): Promise<Resultado> {
  const userId = ctx.userId;
  if (userId === null) return no(MENSAJES_BANDEJA.sinPermiso);
  return transicion(
    ctx,
    chatId,
    (chat) => (chat.estado === "HUMANO" && chat.asignadoUserId === userId ? null : alTomar(aEstado(chat), userId, ctx.userLabel)),
    deps.ahora ?? new Date(),
  );
}

export async function devolverAlBot(ctx: CtxBandeja, chatId: string, deps: Deps = {}): Promise<Resultado> {
  const userId = ctx.userId;
  if (userId === null) return no(MENSAJES_BANDEJA.sinPermiso);
  return transicion(
    ctx,
    chatId,
    (chat) => (chat.estado === "BOT" && chat.asignadoUserId === null ? null : alDevolver(userId, ctx.userLabel)),
    deps.ahora ?? new Date(),
  );
}

export async function resolver(ctx: CtxBandeja, chatId: string, deps: Deps = {}): Promise<Resultado> {
  const userId = ctx.userId;
  if (userId === null) return no(MENSAJES_BANDEJA.sinPermiso);
  return transicion(ctx, chatId, (chat) => (chat.estado === "RESUELTO" ? null : alResolver(userId, ctx.userLabel)), deps.ahora ?? new Date());
}

/** Marca el chat como leído (VIEW alcanza: no cambia quién lo atiende). */
export async function marcarLeido(ctx: CtxBandeja, chatId: string): Promise<Resultado> {
  if (!puedeVerBandeja(ctx)) return no(MENSAJES_BANDEJA.sinPermiso);
  const r = await prisma.fotofficeWaChat.updateMany({ where: { id: chatId, workspaceId: ctx.workspaceId }, data: { noLeidos: 0 } });
  return r.count > 0 ? { ok: true } : no(MENSAJES_BANDEJA.noExiste);
}

/**
 * Responde desde el panel (§3, §6). En una transacción con candado: valida la ventana de 24 h,
 * toma el chat si hace falta (queda un SISTEMA) y deja el mensaje PENDIENTE con su autor. FUERA de
 * la transacción llama a Meta (o simula) y recién ahí pasa el mensaje a SIMULADO, ENVIADO o FALLO.
 */
export async function responder(
  ctx: CtxBandeja,
  chatId: string,
  textoCrudo: unknown,
  deps: Deps = {},
): Promise<Resultado<{ mensajeId: string; estadoEnvio: string }>> {
  const userId = ctx.userId;
  if (userId === null || !puedeOperarBandeja(ctx)) return no(MENSAJES_BANDEJA.sinPermiso);
  const texto = typeof textoCrudo === "string" ? textoCrudo.trim() : "";
  if (!texto) return no(MENSAJES_BANDEJA.textoVacio);
  if (texto.length > TEXTO_MAXIMO) return no(MENSAJES_BANDEJA.textoLargo);
  const ahora = deps.ahora ?? new Date();

  let guardado: { mensajeId: string; waId: string };
  try {
    const r = await prisma.$transaction(async (tx) => {
      const chat = await chatBloqueado(tx, ctx.workspaceId, chatId);
      if (!chat) return no(MENSAJES_BANDEJA.noExiste);
      if (!puedeResponderLibre(aEstado(chat), ahora)) return no(MENSAJES_BANDEJA.fueraDeVentana);
      const regla = alResponderDesdePanel(aEstado(chat), userId, ctx.userLabel);
      if (regla.sistema) await escribirSistema(tx, ctx.workspaceId, chat.id, regla.sistema.texto, ahora);
      const m = await tx.fotofficeWaMensaje.create({
        data: {
          workspaceId: ctx.workspaceId, chatId: chat.id, direccion: "SALIENTE", autor: "USUARIO", autorUserId: userId,
          autorLabel: ctx.userLabel, tipo: "TEXTO", texto, estadoEnvio: "PENDIENTE", createdAt: new Date(ahora.getTime() + 1),
        },
        select: { id: true },
      });
      await tx.fotofficeWaChat.update({
        where: { id: chat.id },
        data: {
          ...regla.parche, noLeidos: 0,
          ...(ahora.getTime() > chat.ultimoMensajeEn.getTime() ? { ultimoMensajeEn: new Date(ahora.getTime() + 1) } : {}),
        },
      });
      return { ok: true as const, mensajeId: m.id, waId: chat.waId };
    });
    if (!r.ok) return r;
    guardado = r;
  } catch (e) {
    console.error("[fotoffice][whatsapp] falló al guardar una respuesta", detalleDeError(e));
    return no(MENSAJES_BANDEJA.fallo);
  }

  // Fuera de la transacción: la red no puede tener el candado de la fila tomado.
  let envio: ResultadoEnvio;
  try {
    const conexion = await leerConexion(ctx.workspaceId);
    envio = await (deps.enviar ?? enviarTexto)(conexion, guardado.waId, texto);
  } catch {
    envio = { ok: false, codigo: "INTERNO" };
  }

  // Se actualiza apenas vuelve la API: el aviso de estado de Meta puede llegar enseguida.
  const datos: Prisma.FotofficeWaMensajeUpdateInput = !envio.ok
    ? { estadoEnvio: "FALLO", errorCodigo: envio.codigo }
    : envio.simulado
      ? { estadoEnvio: "SIMULADO" }
      : { estadoEnvio: "ENVIADO", waMessageId: envio.waMessageId };
  const estadoEnvio = datos.estadoEnvio as string;
  try {
    await prisma.fotofficeWaMensaje.update({ where: { id: guardado.mensajeId }, data: datos });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002" && envio.ok && !envio.simulado) {
      // Ese waMessageId ya existe (el eco del celular llegó primero): se deja ENVIADO sin id.
      await prisma.fotofficeWaMensaje.update({ where: { id: guardado.mensajeId }, data: { estadoEnvio: "ENVIADO" } }).catch(() => undefined);
    } else {
      console.error("[fotoffice][whatsapp] no se pudo registrar el resultado del envío", detalleDeError(e));
    }
  }
  if (!envio.ok) return no(MENSAJES_BANDEJA.falloEnvio);
  return { ok: true, mensajeId: guardado.mensajeId, estadoEnvio };
}

/** Vincula el chat a un cliente del MISMO workspace. */
export async function vincularCliente(ctx: CtxBandeja, chatId: string, clientId: unknown): Promise<Resultado> {
  if (!puedeOperarBandeja(ctx)) return no(MENSAJES_BANDEJA.sinPermiso);
  if (typeof clientId !== "string" || !clientId) return no(MENSAJES_BANDEJA.cliente);
  const cliente = await prisma.client.findFirst({ where: { id: clientId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!cliente) return no(MENSAJES_BANDEJA.cliente);
  const r = await prisma.fotofficeWaChat.updateMany({ where: { id: chatId, workspaceId: ctx.workspaceId }, data: { clientId: cliente.id } });
  return r.count > 0 ? { ok: true } : no(MENSAJES_BANDEJA.noExiste);
}

/**
 * Crea la ficha del contacto con el teléfono del chat y la vincula. Pide además "Gestionar" en
 * Clientes: crear una ficha es una escritura del padrón. Si ya hay un cliente con ese teléfono se
 * vincula ése en lugar de duplicarlo.
 */
export async function crearContactoDesdeChat(ctx: CtxBandeja, chatId: string, nombre?: unknown): Promise<Resultado<{ clientId: string }>> {
  const userId = ctx.userId;
  if (userId === null || !puedeOperarBandeja(ctx)) return no(MENSAJES_BANDEJA.sinPermiso);
  if (!puedeEnContexto(ctx, "operar", CLIENTS_MODULE_KEY)) return no(MENSAJES_BANDEJA.sinPermisoClientes);
  try {
    return await prisma.$transaction(async (tx): Promise<Resultado<{ clientId: string }>> => {
      const chat = await chatBloqueado(tx, ctx.workspaceId, chatId);
      if (!chat) return no(MENSAJES_BANDEJA.noExiste);
      if (chat.clientId) return no(MENSAJES_BANDEJA.yaVinculado);
      let clientId = await clienteDelTelefono(ctx.workspaceId, chat.waId, tx);
      if (!clientId) {
        const completo = (typeof nombre === "string" ? nombre.trim() : "") || chat.nombre?.trim() || "Contacto de WhatsApp";
        const [primero, ...resto] = completo.slice(0, 120).split(/\s+/);
        const creado = await findOrCreateClient(
          tx,
          {
            workspaceId: ctx.workspaceId, phone: chat.waId, firstName: primero ?? completo, lastName: resto.join(" ") || null,
            createdByUserId: userId,
          },
          { userId, label: ctx.userLabel },
        );
        clientId = creado.id;
      }
      await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: { clientId } });
      return { ok: true, clientId };
    });
  } catch (e) {
    console.error("[fotoffice][whatsapp] falló al crear el contacto", detalleDeError(e));
    return no(MENSAJES_BANDEJA.fallo);
  }
}
