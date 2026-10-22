import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { saldoSinExtrasOpcionales } from "@/lib/pedidos/candado-saldo";
import { bloquearPedido } from "@/lib/pedidos/plan";
import { enlaceDelPedidoDelSistema, MENSAJES_ENLACE } from "@/lib/pedidos/enlace";
import { hashDeToken, resolverClaveDeEnlace } from "@/lib/presupuestos/enlace";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { correoValido } from "@/lib/plantillas/contexto";
import { ID_VALIDO, claveDeVideoFinal, esPrefijoHlsDe, prefijoDeGrabacion } from "../claves";
import { DIGITALIZACION_MODULE_KEY } from "../constants";
import { correoRecordatorioVideos, correoVideoAgregado, correoVideosListos, type Correo } from "../correos-entrega";
import {
  HORAS_ESPERA_AUTOMATICO, diasQueFaltan, envioAutomaticoDesde, estadoDeEntrega, extensionPorVideosNuevos, recordatorioQueCorresponde, tituloDeVideo,
  urlDeVideos, vencimientosDesde, videosVencidos, type PreparacionEntrega,
} from "../entrega";
import { MAX_GENERACIONES_ENTREGA, generacionDeEntrega, tokenDeEntrega } from "../token-entrega";
import { borrarVideoFinal } from "./almacen";
import { aplicarCargosPagados, anularCargosSinSentido, cargosARevisar, cargosPendientes, type CargoARevisar, type CargoPendiente } from "./cargos";

/**
 * La entrega de los videos de un pedido (spec 2026-10-22, E1, E2, E3 y E8), del lado del servidor.
 *
 * - **Una por pedido** (`DigitalizacionEntrega.pedidoId` único). Nace la primera vez que alguien la
 *   mira (el cron o la lista) con `envioAutomatico` tomado de los ajustes del negocio.
 * - **Enviar** genera el token, fija los vencimientos (30 días) y manda el correo al contacto del
 *   pedido. **Reenviar** no toca los vencimientos: rota el token (el enlace viejo deja de abrir) y
 *   manda el mismo correo. Si el correo no sale, se vuelve atrás lo escrito.
 * - **Sin correo del cliente:** el cron no la manda; la lista lo muestra y "Copiar enlace" la da
 *   por enviada para mandarla por WhatsApp.
 * - **Varios cassettes:** el envío automático espera 12 h desde la última actividad del pedido. Un
 *   video que se convierte después del envío corre el vencimiento y avisa con el mismo enlace.
 * - **Pedidos cancelados:** no se envían, no se ven y no se descargan.
 * - Los correos van con clave de idempotencia (entrega + generación + tipo): un reintento dentro de
 *   las 24 h no le llega dos veces al cliente.
 * - Todo filtra por `workspaceId`. Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type DepsEntrega = {
  ahora?: () => Date;
  /** Clave de los enlaces; por omisión, `resolverClaveDeEnlace()`. */
  clave?: string | null;
  /** Origen de la app (`https://…`); por omisión, el del entorno. */
  appOrigin?: string;
  enviar?: (m: OutboundEmail) => Promise<SendOutcome>;
};

export type ResultadoEntrega<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

export const MENSAJES_ENTREGA = {
  noExiste: "No encontramos esa entrega.",
  noLista: "Todavía no están todos los videos listos.",
  borrada: "Los videos de esta entrega ya se borraron.",
  yaEnviada: "Esta entrega ya se envió. Usá «Reenviar».",
  sinEnviar: "Esta entrega todavía no se envió.",
  enParalelo: "Alguien acaba de cambiar esta entrega. Probá de nuevo.",
  sinEmail: "El cliente no tiene correo cargado. Copiá el enlace y mandáselo por WhatsApp.",
  cancelado: "El pedido está cancelado: no se envían los videos.",
  correoNoSalio: "El correo no salió. Probá de nuevo o copiá el enlace y mandalo por WhatsApp.",
  tope: "Este enlace ya se renovó demasiadas veces.",
} as const;

function codigo(e: unknown): string {
  const c = (e as { code?: unknown; name?: unknown } | null);
  return typeof c?.code === "string" ? c.code : typeof c?.name === "string" ? c.name : "desconocido";
}

const SELECT_ENTREGA = {
  id: true,
  workspaceId: true,
  pedidoId: true,
  envioAutomatico: true,
  accessTokenHash: true,
  enviadoAt: true,
  videosVencenAt: true,
  cassettesVencenAt: true,
  recordatorios: true,
  videosBorradosAt: true,
} as const;

type EntregaLeida = Prisma.DigitalizacionEntregaGetPayload<{ select: typeof SELECT_ENTREGA }>;

/** Las grabaciones de los trabajos de un pedido (sólo las del negocio). */
export async function grabacionesDelPedido(workspaceId: string, pedidoId: string) {
  return prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, proyecto: { pedidoId, workspaceId } },
    orderBy: [{ iniciadaAt: "asc" }],
    select: {
      id: true, proyectoId: true, estado: true, conversionEstado: true, titulo: true, tipo: true, cassetteNumero: true,
      videoDuracionSeg: true, videoKey: true, hlsKey: true, videoBorradoAt: true, descargasExtra: true,
      sinImagen: true, terminadaAt: true, convertidaAt: true,
    },
  });
}

// --- E1 / E2 ----------------------------------------------------------------------------------

/**
 * La entrega del pedido; si no existe, la crea con `envioAutomatico` de los ajustes. Idempotente:
 * dos llamadas a la vez terminan en la misma fila (el `pedidoId` es único). null si el pedido no es
 * del negocio. Devuelve también si ya está lista para enviar (E2) y desde cuándo sale sola.
 */
export async function asegurarEntrega(
  workspaceId: string,
  pedidoId: string,
): Promise<{ entrega: EntregaLeida; preparacion: PreparacionEntrega; enviaSoloDesde: Date | null } | null> {
  if (!ID_VALIDO.test(pedidoId)) return null;
  let entrega = await prisma.digitalizacionEntrega.findUnique({ where: { pedidoId }, select: SELECT_ENTREGA });
  if (entrega && entrega.workspaceId !== workspaceId) return null;
  if (!entrega) {
    const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true } });
    if (!pedido) return null;
    const ajustes = await prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { envioAutomatico: true } });
    try {
      entrega = await prisma.digitalizacionEntrega.create({
        data: { workspaceId, pedidoId, envioAutomatico: ajustes?.envioAutomatico ?? true },
        select: SELECT_ENTREGA,
      });
    } catch (e) {
      // Otra corrida la creó en el medio: se usa esa.
      if (codigo(e) !== "P2002") throw e;
      entrega = await prisma.digitalizacionEntrega.findUnique({ where: { pedidoId }, select: SELECT_ENTREGA });
      if (!entrega || entrega.workspaceId !== workspaceId) return null;
    }
  }
  const grabaciones = await grabacionesDelPedido(workspaceId, pedidoId);
  return { entrega, preparacion: estadoDeEntrega(grabaciones), enviaSoloDesde: envioAutomaticoDesde(grabaciones) };
}

/** El interruptor "Enviar automáticamente" de un pedido (crea la entrega si todavía no existe). */
export async function cambiarEnvioAutomatico(workspaceId: string, pedidoId: string, valor: boolean): Promise<ResultadoEntrega> {
  if (typeof valor !== "boolean") return { ok: false, error: "Los datos no son válidos." };
  const r = await asegurarEntrega(workspaceId, pedidoId);
  if (!r) return { ok: false, error: MENSAJES_ENTREGA.noExiste };
  await prisma.digitalizacionEntrega.updateMany({ where: { id: r.entrega.id, workspaceId }, data: { envioAutomatico: valor } });
  return { ok: true };
}

// --- Enlace -----------------------------------------------------------------------------------

type Sitio = { customDomain: string | null; slug: string | null; appOrigin: string; nombre: string };

async function prepararEnlace(workspaceId: string, deps: DepsEntrega): Promise<{ ok: true; clave: string; sitio: Sitio } | { ok: false; error: string }> {
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return { ok: false, error: MENSAJES_ENLACE.sinClave };
  const s = await sitioDelWorkspace(workspaceId);
  const appOrigin = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
  const sitio = { customDomain: s?.customDomain ?? null, slug: s?.slug ?? null, appOrigin, nombre: s?.nombre ?? "" };
  if (!s || !urlDeVideos({ ...sitio, token: "x" })) return { ok: false, error: MENSAJES_ENLACE.sinSitio };
  return { ok: true, clave, sitio };
}

/** El enlace vigente de una entrega ya enviada (para el recordatorio), sin rotarlo. null si no se puede rearmar. */
async function enlaceVigente(e: EntregaLeida, deps: DepsEntrega): Promise<string | null> {
  const prep = await prepararEnlace(e.workspaceId, deps);
  if (!prep.ok) return null;
  const g = generacionDeEntrega(e.id, e.accessTokenHash, prep.clave);
  return g === null ? null : urlDeVideos({ ...prep.sitio, token: tokenDeEntrega(e.id, prep.clave, g) });
}

// --- E3: enviar, reenviar y copiar enlace -----------------------------------------------------

type DatosDelPedido = {
  numero: string;
  cancelado: boolean;
  email: string | null;
  nombre: string;
  videos: { proyectoId: string | null; titulo: string; duracionSeg: number | null }[];
  proyectoIds: string[];
};

async function datosDelPedido(workspaceId: string, pedidoId: string): Promise<DatosDelPedido | null> {
  const [pedido, grabaciones] = await Promise.all([
    prisma.fotofficePedido.findFirst({
      where: { id: pedidoId, workspaceId },
      select: { number: true, status: true, client: { select: { firstName: true, businessName: true, email: true } } },
    }),
    grabacionesDelPedido(workspaceId, pedidoId),
  ]);
  if (!pedido) return null;
  const listas = grabaciones.filter((g) => g.estado === "COMPLETA" && g.conversionEstado === "LISTA");
  const email = pedido.client?.email?.trim() ?? "";
  return {
    numero: pedido.number,
    cancelado: pedido.status === "CANCELADO",
    email: correoValido(email) ? email : null,
    nombre: pedido.client?.firstName?.trim() || pedido.client?.businessName?.trim() || "",
    videos: listas.map((g) => ({ proyectoId: g.proyectoId, titulo: tituloDeVideo(g), duracionSeg: g.videoDuracionSeg })),
    proyectoIds: [...new Set(listas.map((g) => g.proyectoId).filter((p): p is string => p !== null))],
  };
}

async function contactoDelNegocio(workspaceId: string): Promise<string | null> {
  const b = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { whatsapp: true, phone: true } });
  return b?.whatsapp ? `WhatsApp ${b.whatsapp}` : b?.phone ? `teléfono ${b.phone}` : null;
}

/** Clave de idempotencia del correo: entrega + generación (o vencimiento) + tipo. */
function claveDeCorreo(entregaId: string, parte: string, tipo: string): string {
  return `fotoffice-videos:${entregaId}:${parte}:${tipo}`;
}

async function mandar(workspaceId: string, email: string, correo: Correo, idempotencyKey: string, deps: DepsEntrega): Promise<boolean> {
  try {
    const sender = await loadWorkspaceSender(workspaceId);
    const r = await (deps.enviar ?? sendTransactionalEmail)({ to: email, ...correo, sender, idempotencyKey });
    if (r.status !== "SENT") console.error("[digitalizacion][entrega] el correo no salió", { status: r.status });
    return r.status === "SENT";
  } catch (e) {
    console.error("[digitalizacion][entrega] el correo falló", { codigo: codigo(e) });
    return false;
  }
}

/** Deja una nota en cada trabajo del pedido con videos (el historial lo ve el equipo). Nunca lanza. */
async function anotar(workspaceId: string, proyectoIds: string[], body: string): Promise<void> {
  if (proyectoIds.length === 0) return;
  try {
    await prisma.fotofficeProyectoNota.createMany({ data: proyectoIds.map((proyectoId) => ({ workspaceId, proyectoId, body, authorUserId: null })) });
  } catch (e) {
    console.error("[digitalizacion][entrega] no se pudo dejar la nota", { codigo: codigo(e) });
  }
}

export type ModoEnvio = "CORREO" | "ENLACE";
export type ResultadoEnvio = ResultadoEntrega<{ url: string; correo: "ENVIADO" | "SIN_EMAIL" | "NO_PEDIDO" }>;

/**
 * Envía (o reenvía) la entrega. Con "CORREO" manda el correo «Tus videos están listos» al contacto
 * del pedido; si no tiene correo, falla con `sinEmail` sin tocar nada. Con "ENLACE" ("Copiar
 * enlace") no manda correo: devuelve la dirección para WhatsApp.
 *
 * - La primera vez fija `enviadoAt`, los vencimientos (+30 días) y vacía `recordatorios`. Exige que
 *   la entrega esté lista (E2).
 * - Las siguientes NO cambian los vencimientos: pasan el token a la generación siguiente (el enlace
 *   anterior deja de abrir).
 * - Las escrituras son condicionales sobre lo leído: dos envíos a la vez no rotan dos veces ni
 *   fijan dos fechas. Si el correo no sale, se vuelve al estado anterior.
 */
export async function enviarEntrega(workspaceId: string, entregaId: string, modo: ModoEnvio = "CORREO", deps: DepsEntrega = {}): Promise<ResultadoEnvio> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  if (!ID_VALIDO.test(entregaId)) return { ok: false, error: MENSAJES_ENTREGA.noExiste };
  const e = await prisma.digitalizacionEntrega.findFirst({ where: { id: entregaId, workspaceId }, select: SELECT_ENTREGA });
  if (!e) return { ok: false, error: MENSAJES_ENTREGA.noExiste };
  if (e.videosBorradosAt || videosVencidos(e, ahora)) return { ok: false, error: MENSAJES_ENTREGA.borrada };
  const primera = e.enviadoAt === null;
  if (primera) {
    const preparacion = estadoDeEntrega(await grabacionesDelPedido(workspaceId, e.pedidoId));
    if (preparacion !== "LISTA") return { ok: false, error: MENSAJES_ENTREGA.noLista };
  }
  const datos = await datosDelPedido(workspaceId, e.pedidoId);
  if (!datos) return { ok: false, error: MENSAJES_ENTREGA.noExiste };
  if (datos.cancelado) return { ok: false, error: MENSAJES_ENTREGA.cancelado };
  if (modo === "CORREO" && !datos.email) return { ok: false, error: MENSAJES_ENTREGA.sinEmail };
  const prep = await prepararEnlace(workspaceId, deps);
  if (!prep.ok) return prep;

  const actual = generacionDeEntrega(e.id, e.accessTokenHash, prep.clave);
  const generacion = actual === null ? 0 : actual + 1;
  if (generacion > MAX_GENERACIONES_ENTREGA) return { ok: false, error: MENSAJES_ENTREGA.tope };
  const token = tokenDeEntrega(e.id, prep.clave, generacion);
  const hash = hashDeToken(token);
  const url = urlDeVideos({ ...prep.sitio, token })!;
  const venc = primera ? vencimientosDesde(ahora) : { videosVencenAt: e.videosVencenAt!, cassettesVencenAt: e.cassettesVencenAt ?? e.videosVencenAt! };

  const escrito = await prisma.digitalizacionEntrega.updateMany({
    where: primera
      ? { id: e.id, workspaceId, enviadoAt: null }
      : { id: e.id, workspaceId, accessTokenHash: e.accessTokenHash, videosBorradosAt: null },
    data: primera ? { accessTokenHash: hash, enviadoAt: ahora, ...venc, recordatorios: [] } : { accessTokenHash: hash },
  });
  if (escrito.count !== 1) return { ok: false, error: primera ? MENSAJES_ENTREGA.yaEnviada : MENSAJES_ENTREGA.enParalelo };

  if (modo === "ENLACE") {
    if (primera) await anotar(workspaceId, datos.proyectoIds, "Videos digitalizados: se copió el enlace para mandarlo al cliente (no se envió correo).");
    return { ok: true, url, correo: "NO_PEDIDO" };
  }

  const [saldo, enlacePedido, contacto] = await Promise.all([
    // El saldo que habilita los videos: sin los extras opcionales (descargas, extensión, envío).
    saldoSinExtrasOpcionales(prisma as unknown as Tx, workspaceId, e.pedidoId),
    enlaceDelPedidoDelSistema(workspaceId, e.pedidoId, {}, { clave: prep.clave, appOrigin: prep.sitio.appOrigin }),
    contactoDelNegocio(workspaceId),
  ]);
  const correo = correoVideosListos({
    estudio: prep.sitio.nombre || "el estudio",
    nombre: datos.nombre,
    pedidoNumero: datos.numero,
    videos: datos.videos,
    saldoMinor: saldo?.saldoMinor ?? 0,
    urlPedido: enlacePedido.ok ? enlacePedido.url : null,
    urlVideos: url,
    videosVencenAt: venc.videosVencenAt,
    cassettesVencenAt: venc.cassettesVencenAt,
    contacto,
  });
  const salio = await mandar(workspaceId, datos.email!, correo, claveDeCorreo(e.id, `g${generacion}`, "listos"), deps);
  if (!salio) {
    // Se vuelve atrás sólo si nadie la tocó después (el hash sigue siendo el nuestro).
    await prisma.digitalizacionEntrega.updateMany({
      where: { id: e.id, workspaceId, accessTokenHash: hash },
      data: primera
        ? { accessTokenHash: null, enviadoAt: null, videosVencenAt: null, cassettesVencenAt: null, recordatorios: [] }
        : { accessTokenHash: e.accessTokenHash },
    });
    return { ok: false, error: MENSAJES_ENTREGA.correoNoSalio };
  }
  await anotar(workspaceId, datos.proyectoIds, `Correo «Tus videos están listos» ${primera ? "enviado" : "reenviado"} a ${datos.email}.`);
  return { ok: true, url, correo: "ENVIADO" };
}

// --- Lista interna ----------------------------------------------------------------------------

export type ResumenEntrega = {
  pedidoId: string;
  pedidoNumero: string;
  cliente: string | null;
  tieneEmail: boolean;
  cancelado: boolean;
  preparacion: PreparacionEntrega;
  videos: number;
  /** Desde cuándo la manda sola el cron (12 h después de la última actividad); null = sin fechas. */
  enviaSoloDesde: Date | null;
  entrega: Pick<EntregaLeida, "id" | "envioAutomatico" | "enviadoAt" | "videosVencenAt" | "cassettesVencenAt" | "videosBorradosAt"> | null;
  /** Envío de los cassettes (E9); null = no se pidió. */
  envio: { estado: string; direccion: string | null; km: number | null; precioMinor: number | null } | null;
  /** Cargos extra sin pagar (E6). */
  cargosPendientes: CargoPendiente[];
  /** Cargos "a revisar": el plan se editó a mano y ya no cuadran. */
  cargosARevisar: CargoARevisar[];
};

export const PEDIDOS_EN_LA_LISTA = 60;

/**
 * Las entregas de los pedidos con grabaciones (los más nuevos primero). Primero elige los pedidos y
 * después trae TODAS sus grabaciones, así el estado no depende de cuántas haya en el negocio. No
 * crea filas: un pedido sin entrega se muestra con su preparación y el valor por defecto.
 */
export async function resumenDeEntregas(workspaceId: string): Promise<ResumenEntrega[]> {
  const pedidos = await prisma.fotofficePedido.findMany({
    where: { workspaceId, proyectos: { some: { workspaceId, grabaciones: { some: { estado: { not: "DESCARTADA" } } } } } },
    orderBy: [{ createdAt: "desc" }],
    take: PEDIDOS_EN_LA_LISTA,
    select: { id: true, number: true, status: true, client: { select: { firstName: true, lastName: true, businessName: true, email: true } } },
  });
  if (pedidos.length === 0) return [];
  const ids = pedidos.map((p) => p.id);
  const [grabaciones, entregas] = await Promise.all([
    prisma.digitalizacionGrabacion.findMany({
      where: { workspaceId, proyecto: { workspaceId, pedidoId: { in: ids } } },
      select: { estado: true, conversionEstado: true, sinImagen: true, terminadaAt: true, convertidaAt: true, proyecto: { select: { pedidoId: true } } },
    }),
    prisma.digitalizacionEntrega.findMany({
      where: { workspaceId, pedidoId: { in: ids } },
      select: { ...SELECT_ENTREGA, envioEstado: true, envioDireccion: true, envioKm: true, envioPrecioArs: true },
    }),
  ]);
  const [pendientes, aRevisar] = await Promise.all([
    cargosPendientes(workspaceId, entregas.map((e) => e.id)),
    cargosARevisar(workspaceId, entregas.map((e) => ({ id: e.id, pedidoId: e.pedidoId }))),
  ]);
  const porPedido = new Map<string, typeof grabaciones>();
  for (const g of grabaciones) {
    const id = g.proyecto?.pedidoId;
    if (id) porPedido.set(id, [...(porPedido.get(id) ?? []), g]);
  }
  const entregaDe = new Map(entregas.map((e) => [e.pedidoId, e]));
  return pedidos.map((p): ResumenEntrega => {
    const gs = porPedido.get(p.id) ?? [];
    const e = entregaDe.get(p.id) ?? null;
    const c = p.client;
    const cliente = c?.businessName?.trim() || [c?.firstName, c?.lastName].map((x) => x?.trim() ?? "").filter(Boolean).join(" ") || null;
    return {
      pedidoId: p.id,
      pedidoNumero: p.number,
      cliente,
      tieneEmail: correoValido(c?.email?.trim() ?? ""),
      cancelado: p.status === "CANCELADO",
      preparacion: estadoDeEntrega(gs),
      videos: gs.filter((g) => g.estado !== "DESCARTADA" && g.conversionEstado === "LISTA").length,
      enviaSoloDesde: envioAutomaticoDesde(gs),
      entrega: e
        ? { id: e.id, envioAutomatico: e.envioAutomatico, enviadoAt: e.enviadoAt, videosVencenAt: e.videosVencenAt, cassettesVencenAt: e.cassettesVencenAt, videosBorradosAt: e.videosBorradosAt }
        : null,
      envio: e?.envioEstado
        ? {
            estado: e.envioEstado,
            direccion: e.envioDireccion ?? null,
            km: e.envioKm ?? null,
            precioMinor: e.envioPrecioArs == null ? null : Math.round(Number(e.envioPrecioArs.toString()) * 100),
          }
        : null,
      cargosPendientes: e ? (pendientes.get(e.id) ?? []).filter((c) => !(aRevisar.get(e.id) ?? []).some((r) => r.id === c.id)) : [],
      cargosARevisar: e ? aRevisar.get(e.id) ?? [] : [],
    };
  });
}

// --- Cron: envío automático y videos agregados (cada 15 min) ----------------------------------

export const TOPE_ENVIOS_CORRIDA = 50;
const CANDIDATAS_POR_CORRIDA = 500;
const HORA_MS = 60 * 60 * 1000;

export type ReporteEnvios = {
  revisadas: number;
  enviadas: number;
  /** Sin correo del cliente: no es una falla (se manda por WhatsApp con "Copiar enlace"). */
  sinEmail: number;
  noListas: number;
  esperando: number;
  manuales: number;
  fallidas: number;
  /** Entregas ya enviadas a las que se les sumó un video (vencimiento corrido). */
  extendidas: number;
  avisosAgregado: number;
  /** Cargos extra con la cuota paga que el cobro no llegó a aplicar (E6). */
  cargosAplicados: number;
};

/** Grabaciones que todavía impiden mandar la entrega (en curso, en cola, con error o muy recientes). */
function trabas(desde: Date): Prisma.DigitalizacionGrabacionWhereInput {
  return {
    estado: { not: "DESCARTADA" },
    OR: [
      { estado: "GRABANDO" },
      { conversionEstado: { in: ["PENDIENTE", "PROCESANDO", "ERROR"] } },
      { terminadaAt: { gt: desde } },
      { convertidaAt: { gt: desde } },
    ],
  };
}

/**
 * Los pedidos a mirar, de más nuevo a más viejo:
 * - los que tienen un video LISTA y todavía no tienen entrega (al crearla salen de este grupo);
 * - las entregas sin enviar con `envioAutomatico`, cliente con correo y sin trabas: las que no
 *   pueden salir no se piden, así nunca llenan el cupo de la consulta.
 * Nunca los cancelados.
 */
async function pedidosParaEnviar(ahora: Date): Promise<{ pedidoId: string; workspaceId: string }[]> {
  const desde = new Date(ahora.getTime() - HORAS_ESPERA_AUTOMATICO * HORA_MS);
  const [sinEntrega, sinEnviar] = await Promise.all([
    prisma.fotofficePedido.findMany({
      where: {
        status: { not: "CANCELADO" },
        digitalizacionEntrega: { is: null },
        proyectos: { some: { grabaciones: { some: { estado: "COMPLETA", conversionEstado: "LISTA" } } } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: CANDIDATAS_POR_CORRIDA,
      select: { id: true, workspaceId: true },
    }),
    prisma.digitalizacionEntrega.findMany({
      where: {
        enviadoAt: null,
        envioAutomatico: true,
        pedido: {
          status: { not: "CANCELADO" },
          client: { email: { contains: "@" } },
          proyectos: { none: { grabaciones: { some: trabas(desde) } } },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: CANDIDATAS_POR_CORRIDA,
      select: { pedidoId: true, workspaceId: true },
    }),
  ]);
  const vistos = new Map<string, string>();
  for (const p of sinEntrega) vistos.set(p.id, p.workspaceId);
  for (const e of sinEnviar) vistos.set(e.pedidoId, e.workspaceId);
  return [...vistos].map(([pedidoId, workspaceId]) => ({ pedidoId, workspaceId }));
}

/**
 * Manda las entregas listas con `envioAutomatico`, pasadas 12 h de la última actividad del pedido.
 * Los clientes sin correo no gastan el tope de envíos. Sólo negocios con Digitalización encendida.
 * Después mira las entregas ya enviadas con videos nuevos (`extenderPorVideosNuevos`).
 */
export async function enviarEntregasAutomaticas(deps: DepsEntrega & { tope?: number } = {}): Promise<ReporteEnvios> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteEnvios = { revisadas: 0, enviadas: 0, sinEmail: 0, noListas: 0, esperando: 0, manuales: 0, fallidas: 0, extendidas: 0, avisosAgregado: 0, cargosAplicados: 0 };
  // Primero los cargos pagos que quedaron sin aplicar (el cobro los aplica después del commit, sin reintento).
  reporte.cargosAplicados = (await aplicarCargosPagados(null, { ahora: () => ahora })).aplicados;
  const encendido = new Map<string, boolean>();
  const estaEncendido = async (ws: string) => {
    if (!encendido.has(ws)) encendido.set(ws, await isModuleEnabledForWorkspace(ws, DIGITALIZACION_MODULE_KEY));
    return encendido.get(ws)!;
  };
  let intentos = 0;
  for (const { pedidoId, workspaceId } of await pedidosParaEnviar(ahora)) {
    if (intentos >= (deps.tope ?? TOPE_ENVIOS_CORRIDA)) break;
    try {
      if (!(await estaEncendido(workspaceId))) continue;
      const r = await asegurarEntrega(workspaceId, pedidoId);
      if (!r || r.entrega.enviadoAt) continue;
      reporte.revisadas++;
      if (!r.entrega.envioAutomatico) { reporte.manuales++; continue; }
      if (r.preparacion !== "LISTA") { reporte.noListas++; continue; }
      if (r.enviaSoloDesde && r.enviaSoloDesde.getTime() > ahora.getTime()) { reporte.esperando++; continue; }
      const env = await enviarEntrega(workspaceId, r.entrega.id, "CORREO", { ...deps, ahora: () => ahora });
      if (!env.ok && env.error === MENSAJES_ENTREGA.sinEmail) { reporte.sinEmail++; continue; }
      intentos++;
      if (env.ok) reporte.enviadas++;
      else reporte.fallidas++;
    } catch (e) {
      reporte.fallidas++;
      console.error("[digitalizacion][entrega] falló el envío automático de un pedido", { codigo: codigo(e) });
    }
  }
  await extenderPorVideosNuevos(ahora, reporte, estaEncendido, deps);
  return reporte;
}

/**
 * Un video que quedó LISTA después del envío tiene sus 30 días: se corre `videosVencenAt` (y
 * `cassettesVencenAt` si queda antes), se vacían los recordatorios y se avisa con el enlace
 * vigente (sin rotarlo). La escritura es condicional sobre el vencimiento leído y, una vez
 * extendida, la condición deja de cumplirse: no hace falta otra columna. Sin correo, sólo extiende.
 */
async function extenderPorVideosNuevos(
  ahora: Date,
  reporte: ReporteEnvios,
  estaEncendido: (ws: string) => Promise<boolean>,
  deps: DepsEntrega,
): Promise<void> {
  // Sólo las que tienen videos convertidos en los últimos 31 días: las demás no pueden extenderse.
  const reciente = new Date(ahora.getTime() - 31 * 24 * HORA_MS);
  const entregas = await prisma.digitalizacionEntrega.findMany({
    where: {
      enviadoAt: { not: null },
      videosBorradosAt: null,
      videosVencenAt: { gt: ahora },
      pedido: {
        status: { not: "CANCELADO" },
        proyectos: { some: { grabaciones: { some: { estado: "COMPLETA", conversionEstado: "LISTA", convertidaAt: { gt: reciente } } } } },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: CANDIDATAS_POR_CORRIDA,
    select: SELECT_ENTREGA,
  });
  for (const e of entregas) {
    try {
      if (!(await estaEncendido(e.workspaceId))) continue;
      const grabaciones = await grabacionesDelPedido(e.workspaceId, e.pedidoId);
      const nuevo = extensionPorVideosNuevos(e.videosVencenAt, grabaciones);
      if (!nuevo) continue;
      const cassettes = e.cassettesVencenAt && e.cassettesVencenAt.getTime() >= nuevo.getTime() ? e.cassettesVencenAt : nuevo;
      const r = await prisma.digitalizacionEntrega.updateMany({
        where: { id: e.id, workspaceId: e.workspaceId, videosVencenAt: e.videosVencenAt, videosBorradosAt: null },
        data: { videosVencenAt: nuevo, cassettesVencenAt: cassettes, recordatorios: [] },
      });
      if (r.count !== 1) continue;
      reporte.extendidas++;
      const datos = await datosDelPedido(e.workspaceId, e.pedidoId);
      if (!datos?.email) continue;
      const url = await enlaceVigente(e, deps);
      if (!url) continue;
      const [sitio, contacto] = await Promise.all([sitioDelWorkspace(e.workspaceId), contactoDelNegocio(e.workspaceId)]);
      const correo = correoVideoAgregado({
        estudio: sitio?.nombre || "el estudio", nombre: datos.nombre, pedidoNumero: datos.numero, videos: datos.videos, urlVideos: url, videosVencenAt: nuevo, contacto,
      });
      if (await mandar(e.workspaceId, datos.email, correo, claveDeCorreo(e.id, `v${nuevo.getTime()}`, "agregado"), deps)) {
        reporte.avisosAgregado++;
        await anotar(e.workspaceId, datos.proyectoIds, `Correo «Agregamos un video a tu pedido» enviado a ${datos.email}.`);
      }
    } catch (err) {
      console.error("[digitalizacion][entrega] falló la extensión por un video nuevo", { codigo: codigo(err) });
    }
  }
}

// --- Cron diario: recordatorios y vencimiento (E8) --------------------------------------------

export type ReporteVencimientos = {
  revisadas: number;
  recordatorios: number;
  /** Sin correo del cliente o de un pedido cancelado: no es una falla. */
  sinEmail: number;
  recordatoriosFallidos: number;
  borradas: number;
  borradoFallido: number;
  cargosAplicados: number;
  cargosAnulados: number;
};

/**
 * Borra de R2 los videos de una entrega vencida. Antes, con los candados del pedido y de la entrega
 * (el mismo orden que aplicar una extensión paga), vuelve a leer `videosVencenAt` y
 * `videosBorradosAt`: si alguien extendió la entrega en el medio (o ya se borró), no borra nada. Si
 * sigue vencida, la marca `videosBorradosAt` en esa misma transacción: así una extensión que se pague
 * mientras se borra ya la ve borrada (y avisa al equipo) en lugar de correr un vencimiento de videos
 * que no existen. Si R2 falla en alguna grabación, se desmarca y la corrida de mañana reintenta
 * (borrar lo que ya no está no falla). Marca `videoBorradoAt` en cada grabación que se pudo borrar.
 *
 * `videoKey` es `digitalizacion/<ws>/<grabacion>/final.mp4`; `hlsKey` es un PREFIJO de carpeta sin
 * barra final (`digitalizacion/<ws>/<grabacion>/hls`) y se borra todo lo que hay adentro. Una clave
 * con forma inesperada no se toca (no se borra algo que no es de la grabación): se registra en el
 * log y la grabación se marca igual, para no fallar todos los días por lo mismo.
 */
export async function borrarVideosDeEntrega(
  e: Pick<EntregaLeida, "id" | "workspaceId" | "pedidoId" | "videosVencenAt">,
  ahora: Date,
): Promise<boolean | "SIN_CAMBIOS"> {
  const reclamada = await prisma.$transaction(async (tx) => {
    await bloquearPedido(tx, e.pedidoId);
    await tx.$queryRaw`SELECT id FROM "DigitalizacionEntrega" WHERE id = ${e.id} FOR UPDATE`;
    const actual = await tx.digitalizacionEntrega.findFirst({ where: { id: e.id, workspaceId: e.workspaceId }, select: { videosVencenAt: true, videosBorradosAt: true } });
    if (!actual || actual.videosBorradosAt || !actual.videosVencenAt) return false;
    if (actual.videosVencenAt.getTime() !== e.videosVencenAt?.getTime() || !videosVencidos(actual, ahora)) return false;
    const r = await tx.digitalizacionEntrega.updateMany({ where: { id: e.id, workspaceId: e.workspaceId, videosBorradosAt: null }, data: { videosBorradosAt: ahora } });
    return r.count === 1;
  });
  if (!reclamada) return "SIN_CAMBIOS";
  const grabaciones = await grabacionesDelPedido(e.workspaceId, e.pedidoId);
  let todas = true;
  for (const g of grabaciones) {
    if (g.videoBorradoAt || (!g.videoKey && !g.hlsKey)) continue;
    const videoOk = g.videoKey !== null && g.videoKey === claveDeVideoFinal(e.workspaceId, g.id);
    const hlsOk = g.hlsKey !== null && esPrefijoHlsDe(e.workspaceId, g.id, g.hlsKey);
    if ((g.videoKey && !videoOk) || (g.hlsKey && !hlsOk)) {
      console.warn("[digitalizacion][entrega] clave con forma inesperada: no se borra y se marca como borrada", { video: Boolean(g.videoKey && !videoOk), hls: Boolean(g.hlsKey && !hlsOk) });
    }
    try {
      if (videoOk || hlsOk) await borrarVideoFinal(prefijoDeGrabacion(e.workspaceId, g.id), videoOk ? g.videoKey : null, hlsOk ? g.hlsKey : null);
      await prisma.digitalizacionGrabacion.updateMany({ where: { id: g.id, workspaceId: e.workspaceId }, data: { videoBorradoAt: ahora } });
    } catch (err) {
      todas = false;
      console.error("[digitalizacion][entrega] no se pudo borrar un video vencido", { codigo: codigo(err) });
    }
  }
  if (!todas) {
    await prisma.digitalizacionEntrega.updateMany({ where: { id: e.id, workspaceId: e.workspaceId, videosBorradosAt: ahora }, data: { videosBorradosAt: null } });
    return false;
  }
  return true;
}

/**
 * Manda el recordatorio del umbral `umbral` de una entrega, con los días que faltan de verdad.
 * Reserva el umbral antes de mandar; si no sale, lo libera.
 */
async function recordar(e: EntregaLeida, umbral: number, ahora: Date, deps: DepsEntrega): Promise<"ENVIADO" | "SIN_EMAIL" | "FALLO"> {
  const datos = await datosDelPedido(e.workspaceId, e.pedidoId);
  if (!datos || datos.cancelado || !datos.email) return "SIN_EMAIL";
  const url = await enlaceVigente(e, deps);
  if (!url) return "FALLO";
  const reservado = await prisma.digitalizacionEntrega.updateMany({
    where: { id: e.id, workspaceId: e.workspaceId, videosBorradosAt: null, NOT: { recordatorios: { has: umbral } } },
    data: { recordatorios: { push: umbral } },
  });
  if (reservado.count !== 1) return "FALLO";
  const [sitio, contacto] = await Promise.all([sitioDelWorkspace(e.workspaceId), contactoDelNegocio(e.workspaceId)]);
  const correo = correoRecordatorioVideos({
    estudio: sitio?.nombre || "el estudio",
    nombre: datos.nombre,
    pedidoNumero: datos.numero,
    urlVideos: url,
    videosVencenAt: e.videosVencenAt!,
    dias: diasQueFaltan(e.videosVencenAt!, ahora),
    contacto,
  });
  const clave = claveDeCorreo(e.id, `v${e.videosVencenAt!.getTime()}`, `recordatorio-${umbral}`);
  if (await mandar(e.workspaceId, datos.email, correo, clave, deps)) {
    await anotar(e.workspaceId, datos.proyectoIds, `Recordatorio «Tus videos se borran» enviado a ${datos.email}.`);
    return "ENVIADO";
  }
  await prisma.digitalizacionEntrega.updateMany({ where: { id: e.id, workspaceId: e.workspaceId }, data: { recordatorios: { set: e.recordatorios } } });
  return "FALLO";
}

/** La corrida diaria (10:00 de Argentina): avisa los vencimientos y borra lo vencido. Devuelve contadores. */
export async function recordatoriosYVencimientos(deps: DepsEntrega = {}): Promise<ReporteVencimientos> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteVencimientos = { revisadas: 0, recordatorios: 0, sinEmail: 0, recordatoriosFallidos: 0, borradas: 0, borradoFallido: 0, cargosAplicados: 0, cargosAnulados: 0 };
  // Antes de borrar nada: una extensión ya paga que el cobro no llegó a aplicar corre el vencimiento.
  reporte.cargosAplicados = (await aplicarCargosPagados(null, { ahora: () => ahora })).aplicados;
  // Y se sacan del pedido los cargos sin pagar que perdieron sentido (videos borrados, cassettes vencidos).
  reporte.cargosAnulados = await anularCargosSinSentido({ ahora: () => ahora });
  const entregas = await prisma.digitalizacionEntrega.findMany({
    where: { enviadoAt: { not: null }, videosBorradosAt: null, videosVencenAt: { not: null } },
    orderBy: { videosVencenAt: "asc" },
    take: 1000,
    select: SELECT_ENTREGA,
  });
  for (const e of entregas) {
    reporte.revisadas++;
    try {
      if (videosVencidos(e, ahora)) {
        const b = await borrarVideosDeEntrega(e, ahora);
        if (b === true) reporte.borradas++;
        else if (b === false) reporte.borradoFallido++;
        continue;
      }
      const umbral = recordatorioQueCorresponde(e, ahora);
      if (umbral === null) continue;
      const r = await recordar(e, umbral, ahora, deps);
      if (r === "ENVIADO") reporte.recordatorios++;
      else if (r === "SIN_EMAIL") reporte.sinEmail++;
      else reporte.recordatoriosFallidos++;
    } catch (err) {
      reporte.recordatoriosFallidos++;
      console.error("[digitalizacion][entrega] falló una entrega en la corrida diaria", { codigo: codigo(err) });
    }
  }
  return reporte;
}
