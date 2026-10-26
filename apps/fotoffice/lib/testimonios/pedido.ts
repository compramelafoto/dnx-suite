import "server-only";
import { prisma } from "@repo/db";
import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";
import { contextoDe, correoValido, type ContextoMensaje } from "@/lib/plantillas/contexto";
import { abrirWhatsapp, completarTextos, enviarCorreo, MENSAJES_ENVIO, type CtxEnvio, type ResultadoEnvio, type ResultadoWhatsapp } from "@/lib/plantillas/envio";
import { asegurarPlantillaTestimonio, TESTIMONIO_INVITACION_INICIAL } from "@/lib/plantillas/semillas";
import { TESTIMONIO_FORM_SEGMENT } from "@/lib/website/constants";
import { AVISO_TABLAS_TESTIMONIOS, esTablaFaltante } from "./dominio";
import { crearInvitacion, MENSAJE_FICHA_AJENA, MENSAJE_SIN_SITIO } from "./invitaciones";

/**
 * «Pedir testimonio» desde la ficha del cliente o del proyecto (sitio, PR 3).
 *
 * 1. `prepararPedidoTestimonio` crea la invitación personal (enlace con token, prellenado con el
 *    nombre del cliente y el trabajo) y devuelve los textos listos para el compositor: el correo
 *    con la plantilla `TESTIMONIO_INVITACION` y el WhatsApp con su texto inicial, los dos con
 *    `[link_testimonio]` ya completado. Un canal sin destino válido no se ofrece: un cliente sin
 *    correo recibe el pedido sólo por WhatsApp.
 * 2. `enviarPedidoTestimonio` lo manda como cualquier mensaje de la ficha (`enviarCorreo` /
 *    `abrirWhatsapp`: permiso `operar`, topes, registro en la línea de tiempo del cliente), con el
 *    enlace personal tapado en el historial, y anota en la invitación por dónde salió.
 *
 * Quién puede: lo decide la acción con la misma guarda que el botón «Mensaje» (operar en Clientes
 * y el cliente del workspace); acá se vuelve a exigir dentro de `enviarCorreo` / `abrirWhatsapp`.
 */

export const MENSAJES_PEDIDO = {
  sinCanal: "Este cliente no tiene correo ni un teléfono válido para WhatsApp: cargá uno para pedirle el testimonio.",
  invitacionVencida: "Ese pedido ya no sirve. Volvé a tocar «Pedir testimonio».",
  falla: "No pudimos preparar el pedido. Probá de nuevo.",
} as const;

/** Marca con la que queda el enlace personal en el historial de mensajes. */
export const ENLACE_TAPADO = "(enlace personal para dejar el testimonio)";

/** Lo que ocupa el lugar de `[link_testimonio]` mientras se arman los textos (sin corchetes ni espacios). */
const MARCA_ENLACE = "__ENLACE_TESTIMONIO_PERSONAL__";

const ENLACE_PERSONAL = new RegExp(`\\S*/${TESTIMONIO_FORM_SEGMENT}\\?t=[A-Za-z0-9_-]{43}`, "g");

/** El texto para el historial: el mismo, con cada enlace personal de testimonio tapado. */
export function taparEnlacePersonal(texto: string): string {
  return texto.replace(ENLACE_PERSONAL, ENLACE_TAPADO);
}

export type CanalesDelPedido = { correo: string | null; whatsapp: string | null };

/** Por dónde se puede pedir: correo válido y teléfono que sirve para WhatsApp. */
export function canalesDelPedido(destino: ContextoMensaje["destino"]): CanalesDelPedido {
  return {
    correo: correoValido(destino.email) ? destino.email : null,
    whatsapp: destino.telefono && normalizeWhatsappNumber(destino.telefono) ? destino.telefono : null,
  };
}

export type PedidoPreparado = {
  ok: true;
  invitacionId: string;
  correo: { destino: string; templateId: string | null; asunto: string; cuerpo: string } | null;
  whatsapp: { destino: string; cuerpo: string } | null;
  /** Por qué falta cada canal (sólo si no está). */
  motivos: { correo: string | null; whatsapp: string | null };
};

type Falla = { ok: false; error: string };

function usuarioDe(ctx: CtxEnvio) {
  return { nombre: ctx.userName ?? ctx.userLabel ?? null, email: ctx.userEmail ?? null };
}

/** El proyecto (si vino) tiene que ser del workspace y de ese cliente. Devuelve su nombre para el detalle. */
async function proyectoDelCliente(workspaceId: string, clientId: string, proyectoId: string): Promise<{ nombre: string } | null> {
  const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId, clientId }, select: { name: true } });
  return p ? { nombre: p.name } : null;
}

export async function prepararPedidoTestimonio(
  ctx: CtxEnvio,
  datos: { clientId: string; proyectoId?: string | null },
): Promise<PedidoPreparado | Falla> {
  const contexto = await contextoDe(ctx.workspaceId, "CLIENTE", datos.clientId, usuarioDe(ctx));
  if (!contexto) return { ok: false, error: MENSAJES_ENVIO.noEncontrado };
  const proyecto = datos.proyectoId ? await proyectoDelCliente(ctx.workspaceId, datos.clientId, datos.proyectoId) : null;
  if (datos.proyectoId && !proyecto) return { ok: false, error: MENSAJES_ENVIO.noEncontrado };

  const canales = canalesDelPedido(contexto.destino);
  if (!canales.correo && !canales.whatsapp) return { ok: false, error: MENSAJES_PEDIDO.sinCanal };

  // Primero los textos (con una marca en lugar del enlace) y recién después la invitación: si los
  // textos no se pueden armar, no queda una invitación creada de más.
  const conMarca: ContextoMensaje = { ...contexto, variables: { ...contexto.variables, testimonio: { enlace: MARCA_ENLACE } } };

  let correo: PedidoPreparado["correo"] = null;
  if (canales.correo) {
    await asegurarPlantillaTestimonio(ctx.workspaceId);
    const plantilla = await prisma.fotofficeMessageTemplate.findFirst({
      where: { workspaceId: ctx.workspaceId, systemKey: "TESTIMONIO_INVITACION", channel: "EMAIL", archivedAt: null },
      select: { id: true, subject: true, body: true },
    });
    const base = plantilla ?? { id: null, subject: TESTIMONIO_INVITACION_INICIAL.EMAIL.asunto, body: TESTIMONIO_INVITACION_INICIAL.EMAIL.cuerpo };
    let textos = completarTextos(conMarca, "TESTIMONIO", base.subject, base.body);
    let templateId = base.id;
    // Si alguien dejó la plantilla con variables que no sirven, sale el texto inicial (sin plantilla).
    if (!textos.ok) {
      textos = completarTextos(conMarca, "TESTIMONIO", TESTIMONIO_INVITACION_INICIAL.EMAIL.asunto, TESTIMONIO_INVITACION_INICIAL.EMAIL.cuerpo);
      templateId = null;
    }
    if (textos.ok) correo = { destino: canales.correo, templateId, asunto: textos.asunto, cuerpo: textos.cuerpo };
  }

  let whatsapp: PedidoPreparado["whatsapp"] = null;
  if (canales.whatsapp) {
    const textos = completarTextos(conMarca, "TESTIMONIO", null, TESTIMONIO_INVITACION_INICIAL.WHATSAPP.cuerpo);
    if (textos.ok) whatsapp = { destino: canales.whatsapp, cuerpo: textos.cuerpo };
  }

  if (!correo && !whatsapp) return { ok: false, error: MENSAJES_PEDIDO.falla };

  let invitacion: { invitacionId: string; enlace: string };
  try {
    invitacion = await crearInvitacion(ctx.workspaceId, {
      clientId: datos.clientId,
      proyectoId: datos.proyectoId ?? null,
      correo: canales.correo,
      nombreSugerido: contexto.variables.persona.nombreCompleto,
      detalleSugerido: proyecto?.nombre ?? null,
      userId: ctx.userId,
      // Un pedido que se abrió y se canceló no deja una invitación por clic: se reusa con token nuevo.
      reusarSinEnviar: true,
    });
  } catch (err) {
    if (esTablaFaltante(err)) return { ok: false, error: AVISO_TABLAS_TESTIMONIOS };
    const m = (err as { message?: unknown })?.message;
    if (m === MENSAJE_SIN_SITIO || m === MENSAJE_FICHA_AJENA) return { ok: false, error: m };
    console.error("[testimonios] no se pudo crear la invitación", { codigo: (err as { code?: unknown })?.code ?? "desconocido" });
    return { ok: false, error: MENSAJES_PEDIDO.falla };
  }
  const conEnlace = (t: string) => t.split(MARCA_ENLACE).join(invitacion.enlace);
  if (correo) correo = { ...correo, asunto: conEnlace(correo.asunto), cuerpo: conEnlace(correo.cuerpo) };
  if (whatsapp) whatsapp = { ...whatsapp, cuerpo: conEnlace(whatsapp.cuerpo) };

  return {
    ok: true,
    invitacionId: invitacion.invitacionId,
    correo,
    whatsapp,
    motivos: {
      correo: correo ? null : MENSAJES_ENVIO.sinCorreo,
      whatsapp: whatsapp ? null : MENSAJES_ENVIO.sinWhatsapp,
    },
  };
}

export type DatosEnvioPedido = {
  clientId: string;
  invitacionId: string;
  canal: "EMAIL" | "WHATSAPP";
  templateId?: string | null;
  asunto?: string;
  cuerpo: string;
};

/**
 * Manda el pedido ya revisado. La invitación tiene que ser del workspace, de ese cliente y seguir
 * ENVIADA (sin responder ni vencida); si no, se pide de nuevo.
 */
export async function enviarPedidoTestimonio(ctx: CtxEnvio, datos: DatosEnvioPedido): Promise<ResultadoEnvio | ResultadoWhatsapp> {
  const inv = await prisma.fotofficeTestimonioInvitacion.findFirst({
    where: { id: datos.invitacionId, workspaceId: ctx.workspaceId, clientId: datos.clientId, estado: "ENVIADA", venceAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!inv) return { ok: false, error: MENSAJES_PEDIDO.invitacionVencida };

  const opciones = { tipoPlantilla: "TESTIMONIO" as const, taparEnRegistro: taparEnlacePersonal };
  const r =
    datos.canal === "EMAIL"
      ? await enviarCorreo(
          ctx,
          { entityType: "CLIENTE", entityId: datos.clientId, templateId: datos.templateId ?? null, asunto: datos.asunto ?? "", cuerpo: datos.cuerpo },
          {},
          opciones,
        )
      : await abrirWhatsapp(ctx, { entityType: "CLIENTE", entityId: datos.clientId, templateId: null, cuerpo: datos.cuerpo }, opciones);

  if (r.ok) {
    try {
      await prisma.fotofficeTestimonioInvitacion.updateMany({ where: { id: inv.id, workspaceId: ctx.workspaceId }, data: { canal: datos.canal } });
    } catch (err) {
      // El mensaje ya salió: que no se anote el canal no cambia nada para el cliente.
      console.error("[testimonios] no se pudo anotar el canal de la invitación", { codigo: (err as { code?: unknown })?.code ?? "desconocido" });
    }
  }
  return r;
}
