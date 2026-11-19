import "server-only";
import { prisma } from "@repo/db";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { MENSAJES_BANDEJA, puedeOperarBandeja, puedeVerBandeja, type CtxBandeja } from "./acceso";
import { aEstado, canalDe, chatBloqueado, escribirSistema, guardarResultadoDelEnvio, type Resultado, type RespuestaEnviada } from "./acciones";
import { leerConexion, type Conexion } from "./conexion";
import { enviarPlantilla } from "./plantilla-meta";
import { armarTexto, paraElegir, parsearPlantillas, validarValores, type DatosParaSugerir, type PlantillaDisponible, type PlantillaParaElegir } from "./plantillas-puro";
import { alResponderDesdePanel } from "./reglas";
import { detalleDeError } from "./registro";
import { vistaPreviaDe } from "./vista-previa";
import { resolverClaveDeEnlace, tokenDeVersion } from "@/lib/presupuestos/enlace";

/**
 * Plantillas aprobadas de Meta desde la Bandeja: la lista (leída de Meta, con un rato de memoria)
 * y el envío por una persona. Igual que `responder`: el workspace y el usuario salen de la sesión,
 * el chat se busca por id Y workspace, hay idempotencia por `clientToken`, y nunca se loguean
 * teléfonos, textos ni el token.
 */

const TIEMPO_MAXIMO_MS = 10_000;
/** Cuánto se recuerda la lista de Meta (una plantilla nueva tarda en aprobarse; no hace falta más fresco). */
const MEMORIA_MS = 5 * 60_000;
const TOKEN_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const NOMBRE_VALIDO = /^[a-z0-9_]{1,512}$/;
const IDIOMA_VALIDO = /^[A-Za-z_]{2,10}$/;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

export const MENSAJES_PLANTILLAS = {
  noDisponible: "Esa plantilla ya no está aprobada en Meta. Elegí otra.",
  soloWhatsapp: "Instagram no tiene plantillas: hay que esperar a que el cliente vuelva a escribir.",
  sinBoton: "Completá el enlace del botón.",
} as const;

const memoria = new Map<string, { hasta: number; plantillas: PlantillaDisponible[] }>();

type DepsLista = { fetch?: typeof fetch; leerToken?: (workspaceId: string) => Promise<string | null>; ahora?: number };

/**
 * Las plantillas aprobadas de la cuenta de WhatsApp del workspace que se pueden mandar desde la
 * Bandeja. Sin conexión real, sin token o si Meta falla: lista vacía (nunca lanza).
 */
export async function plantillasAprobadas(conexion: Pick<Conexion, "workspaceId" | "modo" | "wabaId">, deps: DepsLista = {}): Promise<PlantillaDisponible[]> {
  if (conexion.modo !== "REAL" || !conexion.wabaId) return [];
  const ahora = deps.ahora ?? Date.now();
  const clave = `${conexion.workspaceId}:${conexion.wabaId}`;
  const guardada = memoria.get(clave);
  if (guardada && guardada.hasta > ahora) return guardada.plantillas;
  const token = await (deps.leerToken ?? leerTokenWhatsapp)(conexion.workspaceId).catch(() => null);
  if (!token) return [];
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(conexion.wabaId)}/message_templates?status=APPROVED&fields=name,language,status,category,components&limit=200`;
  try {
    const res = await (deps.fetch ?? fetch)(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    if (!res.ok) {
      console.error("[fotoffice][bandeja] Meta no devolvió las plantillas", { status: res.status });
      return guardada?.plantillas ?? [];
    }
    const plantillas = parsearPlantillas(await res.json().catch(() => null));
    memoria.set(clave, { hasta: ahora + MEMORIA_MS, plantillas });
    return plantillas;
  } catch {
    return guardada?.plantillas ?? [];
  }
}

/** Para las pruebas. */
export function olvidarPlantillas() {
  memoria.clear();
}

/** Lo que se usa para proponer los valores: el nombre, la última consulta del cliente y su próxima cita. */
export async function datosParaSugerir(workspaceId: string, chat: { nombre: string | null; clientId: string | null }, ahora: Date = new Date()): Promise<DatosParaSugerir> {
  if (!chat.clientId) return { nombre: chat.nombre, categoria: null, fechaEvento: null, proximaCita: null, enlaceCotizacion: null };
  const [cliente, consulta, cita, cotizacion, branding] = await Promise.all([
    prisma.client.findFirst({ where: { id: chat.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    prisma.fotofficeConsulta.findFirst({
      where: { workspaceId, clientId: chat.clientId },
      orderBy: { createdAt: "desc" },
      select: { eventStartsAt: true, categoryId: true },
    }),
    prisma.fotofficeCita.findFirst({
      where: { workspaceId, clientId: chat.clientId, startAt: { gte: ahora }, status: { in: ["AGENDADA", "CONFIRMADA"] } },
      orderBy: { startAt: "asc" },
      select: { startAt: true },
    }),
    // La última cotización enviada que sigue abierta: su enlace va en el botón de `seguimiento_cotizacion`.
    prisma.fotofficePresupuesto.findFirst({
      where: { workspaceId, clientId: chat.clientId, status: { in: ["ENVIADO", "VISTO"] }, currentVersionId: { not: null }, acceptedVersionId: null },
      orderBy: { updatedAt: "desc" },
      select: { currentVersionId: true },
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
  ]);
  const clave = resolverClaveDeEnlace();
  const enlaceCotizacion =
    clave && cotizacion?.currentVersionId && branding?.publicSlug
      ? `w/${encodeURIComponent(branding.publicSlug)}/presupuesto/${encodeURIComponent(tokenDeVersion(cotizacion.currentVersionId, clave))}`
      : null;
  const categoria = consulta?.categoryId
    ? await prisma.fotofficeConsultaCategoria.findFirst({ where: { id: consulta.categoryId, workspaceId }, select: { name: true } })
    : null;
  const nombreCliente = cliente?.firstName?.trim() || cliente?.businessName?.trim() || null;
  return {
    nombre: nombreCliente ?? chat.nombre,
    categoria: categoria?.name ?? null,
    fechaEvento: consulta?.eventStartsAt ?? null,
    proximaCita: cita?.startAt ?? null,
    enlaceCotizacion,
  };
}

/** Para la pantalla del chat: las plantillas con los valores propuestos para ESTE chat. */
export async function plantillasDelChat(ctx: CtxBandeja, chatId: string, deps: DepsLista = {}): Promise<PlantillaParaElegir[]> {
  if (!puedeOperarBandeja(ctx) || !puedeVerBandeja(ctx) || !ID_VALIDO.test(chatId)) return [];
  const chat = await prisma.fotofficeWaChat.findFirst({ where: { id: chatId, workspaceId: ctx.workspaceId }, select: { canal: true, nombre: true, clientId: true } });
  if (!chat || canalDe(chat) !== "WHATSAPP") return [];
  const plantillas = await plantillasAprobadas(await leerConexion(ctx.workspaceId), deps);
  if (plantillas.length === 0) return [];
  const datos = await datosParaSugerir(ctx.workspaceId, chat);
  return paraElegir(plantillas, datos);
}

export type EntradaPlantilla = { nombre: unknown; idioma: unknown; valores: unknown; boton?: unknown };

type DepsEnvio = DepsLista & { enviar?: typeof enviarPlantilla; ahora?: number };

/**
 * Manda una plantilla aprobada desde el panel. Sirve dentro y fuera de la ventana de 24 h (fuera es
 * la única forma de escribir). Valida que la plantilla siga aprobada y los valores, toma el chat
 * si hace falta (queda un SISTEMA), deja el mensaje PENDIENTE y recién afuera de la transacción
 * llama a Meta. Un reintento con el mismo `clientToken` no manda dos veces.
 */
export async function enviarPlantillaDesdePanel(
  ctx: CtxBandeja,
  chatId: string,
  entrada: EntradaPlantilla,
  clientToken: unknown,
  deps: DepsEnvio = {},
): Promise<Resultado<RespuestaEnviada>> {
  const no = (error: string) => ({ ok: false as const, error });
  const userId = ctx.userId;
  if (userId === null || !puedeOperarBandeja(ctx)) return no(MENSAJES_BANDEJA.sinPermiso);
  if (typeof clientToken !== "string" || !TOKEN_VALIDO.test(clientToken)) return no(MENSAJES_BANDEJA.sinClientToken);
  if (typeof chatId !== "string" || !ID_VALIDO.test(chatId)) return no(MENSAJES_BANDEJA.noExiste);
  if (typeof entrada.nombre !== "string" || !NOMBRE_VALIDO.test(entrada.nombre) || typeof entrada.idioma !== "string" || !IDIOMA_VALIDO.test(entrada.idioma)) {
    return no(MENSAJES_PLANTILLAS.noDisponible);
  }

  const conexion = await leerConexion(ctx.workspaceId);
  const plantilla = (await plantillasAprobadas(conexion, deps)).find((p) => p.nombre === entrada.nombre && p.idioma === entrada.idioma);
  if (!plantilla) return no(MENSAJES_PLANTILLAS.noDisponible);
  const v = validarValores(plantilla.variables, entrada.valores);
  if (!v.ok) return no(v.error);
  let boton: string | undefined;
  if (plantilla.boton?.dinamico) {
    const b = typeof entrada.boton === "string" ? entrada.boton.trim() : "";
    if (!b || b.length > 200 || /\s/.test(b)) return no(MENSAJES_PLANTILLAS.sinBoton);
    boton = b;
  }
  const texto = armarTexto(plantilla.cuerpo, v.valores);
  const ahora = new Date(deps.ahora ?? Date.now());

  const previo = (chat: string) =>
    prisma.fotofficeWaMensaje.findFirst({ where: { chatId: chat, workspaceId: ctx.workspaceId, clientToken }, select: { id: true, estadoEnvio: true, errorCodigo: true } });

  let guardado: { mensajeId: string; waId: string };
  try {
    type Paso = { ok: false; error: string } | { ok: true; repetido: RespuestaEnviada } | { ok: true; mensajeId: string; waId: string };
    const r = await prisma.$transaction(async (tx): Promise<Paso> => {
      const chat = await chatBloqueado(tx, ctx.workspaceId, chatId);
      if (!chat) return no(MENSAJES_BANDEJA.noExiste);
      if (canalDe(chat) !== "WHATSAPP") return no(MENSAJES_PLANTILLAS.soloWhatsapp);
      const repetido = await tx.fotofficeWaMensaje.findFirst({ where: { chatId: chat.id, workspaceId: ctx.workspaceId, clientToken }, select: { id: true, estadoEnvio: true } });
      if (repetido) return { ok: true, repetido: { mensajeId: repetido.id, estadoEnvio: repetido.estadoEnvio } };
      const regla = alResponderDesdePanel(aEstado(chat), userId, ctx.userLabel);
      if (regla.sistema) await escribirSistema(tx, ctx.workspaceId, chat.id, regla.sistema.texto, ahora);
      const m = await tx.fotofficeWaMensaje.create({
        data: {
          workspaceId: ctx.workspaceId, chatId: chat.id, direccion: "SALIENTE", autor: "USUARIO", autorUserId: userId, autorLabel: ctx.userLabel,
          tipo: "PLANTILLA", texto, media: { plantilla: plantilla.nombre, idioma: plantilla.idioma }, estadoEnvio: "PENDIENTE", clientToken,
          createdAt: new Date(ahora.getTime() + 1),
        },
        select: { id: true },
      });
      await tx.fotofficeWaChat.update({
        where: { id: chat.id },
        data: {
          ...regla.parche, noLeidos: 0,
          ...(ahora.getTime() > chat.ultimoMensajeEn.getTime() ? { ultimoMensajeEn: new Date(ahora.getTime() + 1), ...vistaPreviaDe(texto, "TEXTO") } : {}),
        },
      });
      return { ok: true, mensajeId: m.id, waId: chat.waId };
    });
    if (!r.ok) return r;
    if ("repetido" in r) return { ok: true, ...r.repetido };
    guardado = r;
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") {
      const ganador = await previo(chatId).catch(() => null);
      if (ganador) return { ok: true, mensajeId: ganador.id, estadoEnvio: ganador.estadoEnvio };
    }
    console.error("[fotoffice][whatsapp] falló al guardar una plantilla", detalleDeError(e));
    return no(MENSAJES_BANDEJA.fallo);
  }

  let envio;
  try {
    envio = await (deps.enviar ?? enviarPlantilla)(conexion, guardado.waId, { nombre: plantilla.nombre, idioma: plantilla.idioma, cuerpo: v.valores, boton });
  } catch {
    envio = { ok: false as const, codigo: "INTERNO" };
  }
  const persistido = (await guardarResultadoDelEnvio(guardado.mensajeId, envio, "no se pudo registrar el resultado de la plantilla")) ?? { estadoEnvio: "PENDIENTE", errorCodigo: null };
  if (persistido.estadoEnvio === "FALLO") return no(persistido.errorCodigo === "SIN_TOKEN" ? MENSAJES_BANDEJA.sinToken : MENSAJES_BANDEJA.falloEnvio);
  if (persistido.estadoEnvio === "PENDIENTE") return { ok: true, mensajeId: guardado.mensajeId, estadoEnvio: "PENDIENTE", aviso: MENSAJES_BANDEJA.noConfirmado };
  return { ok: true, mensajeId: guardado.mensajeId, estadoEnvio: persistido.estadoEnvio };
}
