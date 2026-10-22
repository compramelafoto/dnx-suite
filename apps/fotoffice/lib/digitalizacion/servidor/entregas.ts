import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { saldoDelPedido } from "@/lib/pedidos/candado-saldo";
import { enlaceDelPedidoDelSistema, MENSAJES_ENLACE } from "@/lib/pedidos/enlace";
import { hashDeToken, resolverClaveDeEnlace } from "@/lib/presupuestos/enlace";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { correoValido } from "@/lib/plantillas/contexto";
import { ID_VALIDO, prefijoDeGrabacion } from "../claves";
import { DIGITALIZACION_MODULE_KEY } from "../constants";
import { correoRecordatorioVideos, correoVideosListos, type Correo } from "../correos-entrega";
import {
  estadoDeEntrega, recordatorioQueCorresponde, tituloDeVideo, urlDeVideos, vencimientosDesde, videosVencidos, type PreparacionEntrega,
} from "../entrega";
import { MAX_GENERACIONES_ENTREGA, generacionDeEntrega, tokenDeEntrega } from "../token-entrega";
import { borrarVideoFinal } from "./almacen";

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
    },
  });
}

// --- E1 / E2 ----------------------------------------------------------------------------------

/**
 * La entrega del pedido; si no existe, la crea con `envioAutomatico` de los ajustes. Idempotente:
 * dos llamadas a la vez terminan en la misma fila (el `pedidoId` es único). null si el pedido no es
 * del negocio. Devuelve también si ya está lista para enviar (E2).
 */
export async function asegurarEntrega(
  workspaceId: string,
  pedidoId: string,
): Promise<{ entrega: EntregaLeida; preparacion: PreparacionEntrega } | null> {
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
  return { entrega, preparacion: estadoDeEntrega(grabaciones) };
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
  email: string | null;
  nombre: string;
  videos: { proyectoId: string | null; titulo: string; duracionSeg: number | null }[];
  proyectoIds: string[];
};

async function datosDelPedido(workspaceId: string, pedidoId: string): Promise<DatosDelPedido | null> {
  const [pedido, grabaciones] = await Promise.all([
    prisma.fotofficePedido.findFirst({
      where: { id: pedidoId, workspaceId },
      select: { number: true, client: { select: { firstName: true, businessName: true, email: true } } },
    }),
    grabacionesDelPedido(workspaceId, pedidoId),
  ]);
  if (!pedido) return null;
  const listas = grabaciones.filter((g) => g.estado === "COMPLETA" && g.conversionEstado === "LISTA");
  const email = pedido.client?.email?.trim() ?? "";
  return {
    numero: pedido.number,
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

async function mandar(workspaceId: string, email: string, correo: Correo, deps: DepsEntrega): Promise<boolean> {
  try {
    const sender = await loadWorkspaceSender(workspaceId);
    const r = await (deps.enviar ?? sendTransactionalEmail)({ to: email, ...correo, sender });
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
    saldoDelPedido(prisma as unknown as Tx, workspaceId, e.pedidoId),
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
  const salio = await mandar(workspaceId, datos.email!, correo, deps);
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
  preparacion: PreparacionEntrega;
  videos: number;
  entrega: Pick<EntregaLeida, "id" | "envioAutomatico" | "enviadoAt" | "videosVencenAt" | "cassettesVencenAt" | "videosBorradosAt"> | null;
};

/**
 * Las entregas de los pedidos que tienen grabaciones (las más recientes primero). No crea filas:
 * un pedido sin entrega todavía se muestra con su preparación y el valor por defecto del negocio.
 */
export async function resumenDeEntregas(workspaceId: string): Promise<ResumenEntrega[]> {
  const grabaciones = await prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, estado: { not: "DESCARTADA" }, proyecto: { pedidoId: { not: null } } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { estado: true, conversionEstado: true, proyecto: { select: { pedidoId: true } } },
  });
  const porPedido = new Map<string, { estado: string; conversionEstado: string | null }[]>();
  for (const g of grabaciones) {
    const id = g.proyecto?.pedidoId;
    if (!id) continue;
    porPedido.set(id, [...(porPedido.get(id) ?? []), g]);
  }
  const ids = [...porPedido.keys()].slice(0, 60);
  if (ids.length === 0) return [];
  const [pedidos, entregas] = await Promise.all([
    prisma.fotofficePedido.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, number: true, client: { select: { firstName: true, lastName: true, businessName: true, email: true } } },
    }),
    prisma.digitalizacionEntrega.findMany({ where: { workspaceId, pedidoId: { in: ids } }, select: SELECT_ENTREGA }),
  ]);
  const pedidoDe = new Map(pedidos.map((p) => [p.id, p]));
  const entregaDe = new Map(entregas.map((e) => [e.pedidoId, e]));
  return ids.flatMap((id): ResumenEntrega[] => {
    const p = pedidoDe.get(id);
    if (!p) return [];
    const gs = porPedido.get(id) ?? [];
    const e = entregaDe.get(id) ?? null;
    const c = p.client;
    const cliente = c?.businessName?.trim() || [c?.firstName, c?.lastName].map((x) => x?.trim() ?? "").filter(Boolean).join(" ") || null;
    return [{
      pedidoId: id,
      pedidoNumero: p.number,
      cliente,
      tieneEmail: correoValido(c?.email?.trim() ?? ""),
      preparacion: estadoDeEntrega(gs),
      videos: gs.filter((g) => g.conversionEstado === "LISTA").length,
      entrega: e
        ? { id: e.id, envioAutomatico: e.envioAutomatico, enviadoAt: e.enviadoAt, videosVencenAt: e.videosVencenAt, cassettesVencenAt: e.cassettesVencenAt, videosBorradosAt: e.videosBorradosAt }
        : null,
    }];
  });
}

// --- Cron: envío automático (cada 15 min) -----------------------------------------------------

export const TOPE_ENVIOS_CORRIDA = 50;

export type ReporteEnvios = { revisadas: number; enviadas: number; sinEmail: number; noListas: number; manuales: number; fallidas: number };

/**
 * Los pedidos con algún video LISTA cuya entrega no existe o no se envió: crea o mira la entrega y
 * manda las que tienen `envioAutomatico`, están listas y el cliente tiene correo. Sólo negocios con
 * Digitalización encendida. Devuelve contadores.
 */
export async function enviarEntregasAutomaticas(deps: DepsEntrega & { tope?: number } = {}): Promise<ReporteEnvios> {
  const reporte: ReporteEnvios = { revisadas: 0, enviadas: 0, sinEmail: 0, noListas: 0, manuales: 0, fallidas: 0 };
  const candidatas = await prisma.digitalizacionGrabacion.findMany({
    where: {
      estado: "COMPLETA",
      conversionEstado: "LISTA",
      proyecto: { pedidoId: { not: null }, pedido: { OR: [{ digitalizacionEntrega: { is: null } }, { digitalizacionEntrega: { is: { enviadoAt: null } } }] } },
    },
    orderBy: { convertidaAt: "asc" },
    take: 1000,
    select: { workspaceId: true, proyecto: { select: { pedidoId: true } } },
  });
  const pedidos = new Map<string, string>();
  for (const c of candidatas) if (c.proyecto?.pedidoId) pedidos.set(c.proyecto.pedidoId, c.workspaceId);
  const encendido = new Map<string, boolean>();
  let intentos = 0;
  for (const [pedidoId, workspaceId] of pedidos) {
    if (intentos >= (deps.tope ?? TOPE_ENVIOS_CORRIDA)) break;
    try {
      if (!encendido.has(workspaceId)) encendido.set(workspaceId, await isModuleEnabledForWorkspace(workspaceId, DIGITALIZACION_MODULE_KEY));
      if (!encendido.get(workspaceId)) continue;
      const r = await asegurarEntrega(workspaceId, pedidoId);
      if (!r || r.entrega.enviadoAt) continue;
      reporte.revisadas++;
      if (r.preparacion !== "LISTA") { reporte.noListas++; continue; }
      if (!r.entrega.envioAutomatico) { reporte.manuales++; continue; }
      intentos++;
      const env = await enviarEntrega(workspaceId, r.entrega.id, "CORREO", deps);
      if (env.ok) reporte.enviadas++;
      else if (env.error === MENSAJES_ENTREGA.sinEmail) reporte.sinEmail++;
      else reporte.fallidas++;
    } catch (e) {
      reporte.fallidas++;
      console.error("[digitalizacion][entrega] falló el envío automático de un pedido", { codigo: codigo(e) });
    }
  }
  return reporte;
}

// --- Cron diario: recordatorios y vencimiento (E8) --------------------------------------------

export type ReporteVencimientos = { revisadas: number; recordatorios: number; recordatoriosFallidos: number; borradas: number; borradoFallido: number };

/**
 * Borra de R2 los videos de una entrega vencida. Marca `videoBorradoAt` en cada grabación que se
 * pudo borrar y `videosBorradosAt` en la entrega sólo si se borraron todas: si R2 falla en alguna,
 * la entrega queda sin marcar y la corrida de mañana reintenta (borrar lo que ya no está no falla).
 */
export async function borrarVideosDeEntrega(e: Pick<EntregaLeida, "id" | "workspaceId" | "pedidoId">, ahora: Date): Promise<boolean> {
  const grabaciones = await grabacionesDelPedido(e.workspaceId, e.pedidoId);
  let todas = true;
  for (const g of grabaciones) {
    if (g.videoBorradoAt || (!g.videoKey && !g.hlsKey)) continue;
    try {
      await borrarVideoFinal(prefijoDeGrabacion(e.workspaceId, g.id), g.videoKey, g.hlsKey);
      await prisma.digitalizacionGrabacion.updateMany({ where: { id: g.id, workspaceId: e.workspaceId }, data: { videoBorradoAt: ahora } });
    } catch (err) {
      todas = false;
      console.error("[digitalizacion][entrega] no se pudo borrar un video vencido", { codigo: codigo(err) });
    }
  }
  if (!todas) return false;
  await prisma.digitalizacionEntrega.updateMany({ where: { id: e.id, workspaceId: e.workspaceId, videosBorradosAt: null }, data: { videosBorradosAt: ahora } });
  return true;
}

/** Manda el recordatorio de `dias` de una entrega. Reserva el umbral antes de mandar; si no sale, lo libera. */
async function recordar(e: EntregaLeida, dias: number, deps: DepsEntrega): Promise<boolean> {
  const datos = await datosDelPedido(e.workspaceId, e.pedidoId);
  if (!datos?.email) return false;
  const url = await enlaceVigente(e, deps);
  if (!url) return false;
  const reservado = await prisma.digitalizacionEntrega.updateMany({
    where: { id: e.id, workspaceId: e.workspaceId, videosBorradosAt: null, NOT: { recordatorios: { has: dias } } },
    data: { recordatorios: { push: dias } },
  });
  if (reservado.count !== 1) return false;
  const [sitio, contacto] = await Promise.all([sitioDelWorkspace(e.workspaceId), contactoDelNegocio(e.workspaceId)]);
  const correo = correoRecordatorioVideos({
    estudio: sitio?.nombre || "el estudio",
    nombre: datos.nombre,
    pedidoNumero: datos.numero,
    urlVideos: url,
    videosVencenAt: e.videosVencenAt!,
    dias,
    contacto,
  });
  if (await mandar(e.workspaceId, datos.email, correo, deps)) {
    await anotar(e.workspaceId, datos.proyectoIds, `Recordatorio «Tus videos se borran» (faltan ${dias} ${dias === 1 ? "día" : "días"}) enviado a ${datos.email}.`);
    return true;
  }
  await prisma.digitalizacionEntrega.updateMany({ where: { id: e.id, workspaceId: e.workspaceId }, data: { recordatorios: { set: e.recordatorios } } });
  return false;
}

/** La corrida diaria (10:00 de Argentina): avisa los vencimientos y borra lo vencido. Devuelve contadores. */
export async function recordatoriosYVencimientos(deps: DepsEntrega = {}): Promise<ReporteVencimientos> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteVencimientos = { revisadas: 0, recordatorios: 0, recordatoriosFallidos: 0, borradas: 0, borradoFallido: 0 };
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
        if (await borrarVideosDeEntrega(e, ahora)) reporte.borradas++;
        else reporte.borradoFallido++;
        continue;
      }
      const dias = recordatorioQueCorresponde(e, ahora);
      if (dias === null) continue;
      if (await recordar(e, dias, deps)) reporte.recordatorios++;
      else reporte.recordatoriosFallidos++;
    } catch (err) {
      reporte.recordatoriosFallidos++;
      console.error("[digitalizacion][entrega] falló una entrega en la corrida diaria", { codigo: codigo(err) });
    }
  }
  return reporte;
}
