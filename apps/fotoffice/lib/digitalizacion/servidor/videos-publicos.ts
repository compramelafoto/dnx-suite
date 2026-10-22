import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";
import type { OrganizacionPublica } from "@/lib/pedidos/vista-publica";
import { bloquearPedido } from "@/lib/pedidos/plan";
import { enlaceDelPedidoDelSistema } from "@/lib/pedidos/enlace";
import { hashDeToken, tokenConForma } from "@/lib/presupuestos/enlace";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { ID_VALIDO, esPrefijoHlsDe, prefijoDeGrabacion } from "../claves";
import { descargasRestantes, segundosDeFirma, tituloDeVideo, videosVencidos } from "../entrega";
import { vistaPreviaAgotada } from "../hls";
import { nombreArchivoVideo, nombreCliente } from "../nombre-archivo";
import { SEGUNDOS_HLS, urlDeVideo } from "./almacen";
import { cargosPendientes, saldoDeVideosMinor, urlsParaPagar } from "./cargos";
import { esEstadoEnvio, puedeComprarDescarga, puedeExtender, puedePedirEnvio, type EstadoEnvio } from "../cargos";

/** Las firmas de descarga duran 24 h (para reanudar), salvo que la entrega venza antes. */
const SEGUNDOS_DESCARGA = 24 * 3600;
/** Un segundo clic (o un reintento del navegador) dentro de este lapso no gasta otra descarga. */
export const SEGUNDOS_DESCARGA_REPETIDA = 120;

/**
 * La página pública de videos `/<slug>/videos/<token>` (E4) y la descarga contada (E5), sin
 * sesión: el token es la llave y el workspace sale del slug de la dirección.
 *
 * - Con saldo pendiente no se firma ninguna URL: ni para mirar ni para bajar.
 * - Vencida (aunque el cron todavía no haya borrado) se trata como borrada.
 * - Mirar usa SÓLO la versión HLS 720p (E10), servida por la app con segmentos firmados por 4 h:
 *   el MP4 Full HD nunca se firma para mirar, así que no se puede bajar sin pasar por la ruta que
 *   cuenta las descargas.
 * - Ninguna firma dura más que lo que le queda a la entrega (con un piso de 60 s).
 * - Pedido cancelado: no se ve ni se descarga nada.
 * - Los cargos extra sin pagar (E6) no cuentan para el saldo que traba los videos: pedir una
 *   descarga extra no apaga lo que el cliente ya pagó (`saldoDeVideosMinor`).
 */

type Tx = Prisma.TransactionClient;

export type VideoPublico = {
  id: string;
  titulo: string;
  duracionSeg: number | null;
  quedan: number;
  total: number;
  /** Hay versión para mirar y los videos están habilitados (saldo 0, sin vencer ni cancelar). */
  vistaPrevia: boolean;
  /** El worker no pudo armar la versión para mirar (3 intentos): se ofrece descargar. */
  vistaPreviaAgotada: boolean;
  /** Se puede pedir otra descarga (video sin borrar y entrega vigente). */
  puedeComprar: boolean;
  /** Descarga extra pedida y sin pagar: importe (centavos) y dónde pagarla. */
  descargaPendiente: { montoMinor: number; urlPagar: string | null } | null;
};

export type VistaVideosPublica = {
  organizacion: OrganizacionPublica;
  pedidoNumero: string;
  cliente: string | null;
  saldoMinor: number;
  cancelado: boolean;
  urlPedido: string | null;
  /** Fecha en que se borraron (o vencieron); null = siguen disponibles. */
  borradosAt: Date | null;
  videosVencenAt: Date | null;
  cassettesVencenAt: Date | null;
  habilitados: boolean;
  videos: VideoPublico[];
  puedeExtender: boolean;
  extensionPendiente: { montoMinor: number; urlPagar: string | null } | null;
  envio: {
    puedePedir: boolean;
    estado: EstadoEnvio | null;
    direccion: string | null;
    precioMinor: number | null;
    urlPagar: string | null;
  };
};

/** La entrega de un token, dentro del workspace; null si el token no tiene forma, no existe o es de otro. */
export async function resolverTokenEntrega(workspaceId: string, token: unknown) {
  if (!tokenConForma(token)) return null;
  return prisma.digitalizacionEntrega.findFirst({
    where: { workspaceId, accessTokenHash: hashDeToken(token), enviadoAt: { not: null } },
    select: {
      id: true, pedidoId: true, videosVencenAt: true, cassettesVencenAt: true, videosBorradosAt: true,
      envioEstado: true, envioDireccion: true, envioPrecioArs: true,
    },
  });
}

async function videosListos(workspaceId: string, pedidoId: string, entregaId: string) {
  const grabaciones = await prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, estado: "COMPLETA", conversionEstado: "LISTA", proyecto: { pedidoId, workspaceId } },
    orderBy: [{ iniciadaAt: "asc" }],
    select: {
      id: true, titulo: true, tipo: true, cassetteNumero: true, videoDuracionSeg: true, videoKey: true, hlsKey: true, conversionError: true, videoBorradoAt: true, descargasExtra: true,
      _count: { select: { descargas: { where: { entregaId } } } },
    },
  });
  return grabaciones;
}

function borradoDe(e: { videosBorradosAt: Date | null; videosVencenAt: Date | null }, ahora: Date): Date | null {
  if (e.videosBorradosAt) return e.videosBorradosAt;
  return videosVencidos(e, ahora) ? e.videosVencenAt : null;
}

type EntregaResuelta = NonNullable<Awaited<ReturnType<typeof resolverTokenEntrega>>>;

/** Lo que decide si se puede mirar y bajar: pedido no cancelado, saldo 0 y sin vencer ni borrar. */
async function habilitacion(workspaceId: string, e: EntregaResuelta, ahora: Date) {
  const [pedido, saldo] = await Promise.all([
    prisma.fotofficePedido.findFirst({
      where: { id: e.pedidoId, workspaceId },
      select: { number: true, status: true, client: { select: { firstName: true, lastName: true, businessName: true } } },
    }),
    // Sin los extras opcionales sin pagar (E6): pedir una descarga extra no apaga lo ya pagado.
    saldoDeVideosMinor(prisma as unknown as Tx, workspaceId, e.pedidoId),
  ]);
  if (!pedido) return null;
  const cancelado = pedido.status === "CANCELADO";
  const saldoMinor = saldo?.saldoMinor ?? 0;
  const borradosAt = borradoDe(e, ahora);
  return { pedido, cancelado, saldoMinor, borradosAt, habilitados: !cancelado && saldoMinor === 0 && borradosAt === null };
}

export async function abrirEntregaPublica(workspaceId: string, token: unknown, ahora: Date = new Date()): Promise<VistaVideosPublica | null> {
  const e = await resolverTokenEntrega(workspaceId, token);
  if (!e) return null;
  const [h, sitio, grabaciones] = await Promise.all([
    habilitacion(workspaceId, e, ahora),
    sitioDelWorkspace(workspaceId),
    videosListos(workspaceId, e.pedidoId, e.id),
  ]);
  if (!h || !sitio) return null;
  const { pedido, cancelado, saldoMinor, borradosAt, habilitados } = h;
  const cliente = nombreCliente(pedido.client);
  const urlPedido = !cancelado && saldoMinor > 0 ? await enlaceDelPedidoDelSistema(workspaceId, e.pedidoId).then((r) => (r.ok ? r.url : null), () => null) : null;

  const pendientes = (await cargosPendientes(workspaceId, [e.id])).get(e.id) ?? [];
  const pagar = await urlsParaPagar(workspaceId, e.pedidoId, pendientes.map((c) => c.cuotaId));
  const pendiente = (c: (typeof pendientes)[number] | undefined) => (c ? { montoMinor: c.montoMinor, urlPagar: pagar.get(c.cuotaId) ?? null } : null);

  const videos = grabaciones.map((g): VideoPublico => {
    const cupo = descargasRestantes({ descargasExtra: g.descargasExtra, usadas: g._count.descargas });
    const hlsOk = g.hlsKey !== null && esPrefijoHlsDe(workspaceId, g.id, g.hlsKey) && !g.videoBorradoAt;
    return {
      id: g.id,
      titulo: tituloDeVideo(g),
      duracionSeg: g.videoDuracionSeg,
      quedan: cupo.quedan,
      total: cupo.total,
      vistaPrevia: habilitados && hlsOk,
      vistaPreviaAgotada: !hlsOk && vistaPreviaAgotada(g.hlsKey, g.conversionError),
      puedeComprar: puedeComprarDescarga({ cancelado, videosVencenAt: e.videosVencenAt, videosBorradosAt: e.videosBorradosAt }, g, ahora),
      descargaPendiente: pendiente(pendientes.find((c) => c.tipo === "DESCARGA_EXTRA" && c.grabacionId === g.id)),
    };
  });
  return {
    organizacion: {
      nombre: sitio.nombre,
      logoUrl: sitio.logoUrl && /^https:\/\//i.test(sitio.logoUrl) ? sitio.logoUrl : null,
      whatsappUrl: buildWhatsappUrl(sitio.whatsapp, `Hola, tengo una consulta sobre los videos del pedido N° ${pedido.number}.`),
      email: sitio.email,
    },
    pedidoNumero: pedido.number,
    cliente,
    saldoMinor,
    cancelado,
    urlPedido,
    borradosAt,
    videosVencenAt: e.videosVencenAt,
    cassettesVencenAt: e.cassettesVencenAt,
    habilitados,
    videos,
    puedeExtender: puedeExtender({ cancelado, videosVencenAt: e.videosVencenAt, videosBorradosAt: e.videosBorradosAt }, ahora),
    extensionPendiente: pendiente(pendientes.find((c) => c.tipo === "EXTENSION")),
    envio: {
      puedePedir: puedePedirEnvio({ cancelado, cassettesVencenAt: e.cassettesVencenAt, envioEstado: e.envioEstado ?? null }, ahora),
      estado: esEstadoEnvio(e.envioEstado) ? e.envioEstado : null,
      direccion: e.envioDireccion ?? null,
      precioMinor: e.envioPrecioArs == null ? null : Math.round(Number(e.envioPrecioArs.toString()) * 100),
      urlPagar: pendiente(pendientes.find((c) => c.tipo === "ENVIO"))?.urlPagar ?? null,
    },
  };
}

export type MotivoSinVista = "NO_EXISTE" | "CANCELADO" | "SALDO" | "BORRADO" | "PREPARANDO";
export type ResultadoVista = { ok: true; hlsKey: string; segundos: number } | { ok: false; motivo: MotivoSinVista };

/**
 * "Ver" de la página pública (E10): las mismas reglas que la página (token, pedido no cancelado,
 * saldo 0, sin vencer) y que el video sea de ESE pedido. Devuelve la carpeta HLS y cuánto pueden
 * durar las firmas de los segmentos (4 h o lo que le quede a la entrega). Mirar no cuenta descargas.
 */
export async function vistaDeEntregaPublica(workspaceId: string, token: unknown, grabacionId: unknown, ahora: Date = new Date()): Promise<ResultadoVista> {
  if (typeof grabacionId !== "string" || !ID_VALIDO.test(grabacionId)) return { ok: false, motivo: "NO_EXISTE" };
  const e = await resolverTokenEntrega(workspaceId, token);
  if (!e) return { ok: false, motivo: "NO_EXISTE" };
  const [h, g] = await Promise.all([
    habilitacion(workspaceId, e, ahora),
    prisma.digitalizacionGrabacion.findFirst({
      where: { id: grabacionId, workspaceId, estado: "COMPLETA", conversionEstado: "LISTA", proyecto: { pedidoId: e.pedidoId, workspaceId } },
      select: { id: true, hlsKey: true, videoBorradoAt: true },
    }),
  ]);
  if (!h || !g) return { ok: false, motivo: "NO_EXISTE" };
  if (h.cancelado) return { ok: false, motivo: "CANCELADO" };
  if (h.borradosAt || g.videoBorradoAt) return { ok: false, motivo: "BORRADO" };
  if (h.saldoMinor > 0) return { ok: false, motivo: "SALDO" };
  if (!g.hlsKey || !esPrefijoHlsDe(workspaceId, g.id, g.hlsKey)) return { ok: false, motivo: "PREPARANDO" };
  return { ok: true, hlsKey: g.hlsKey, segundos: segundosDeFirma(SEGUNDOS_HLS, e.videosVencenAt, ahora) };
}

export type MotivoSinDescarga = "NO_EXISTE" | "CANCELADO" | "SALDO" | "BORRADO" | "SIN_CUPO";
export type ResultadoDescarga = { ok: true; url: string } | { ok: false; motivo: MotivoSinDescarga };

/**
 * E5: valida el token, que el video sea de ESE pedido, el saldo, el vencimiento y el cupo; registra
 * la descarga y devuelve la URL firmada (24 h o lo que le quede a la entrega, attachment). El cupo
 * se cuenta y se registra dentro de una transacción con la entrega bloqueada (`FOR UPDATE`) y el
 * candado del pedido (el de cobrar y anular) antes de leer el saldo: dos clics a la vez no superan
 * el cupo y un cobro anulado en el medio no deja bajar con deuda. Si ya hubo una descarga de ese
 * video en los últimos 2 minutos, se vuelve a firmar sin contar.
 */
export async function registrarDescarga(workspaceId: string, token: unknown, grabacionId: unknown, ahora: Date = new Date()): Promise<ResultadoDescarga> {
  if (typeof grabacionId !== "string" || !ID_VALIDO.test(grabacionId)) return { ok: false, motivo: "NO_EXISTE" };
  const e = await resolverTokenEntrega(workspaceId, token);
  if (!e) return { ok: false, motivo: "NO_EXISTE" };
  if (borradoDe(e, ahora)) return { ok: false, motivo: "BORRADO" };
  const g = await prisma.digitalizacionGrabacion.findFirst({
    where: { id: grabacionId, workspaceId, estado: "COMPLETA", conversionEstado: "LISTA", proyecto: { pedidoId: e.pedidoId, workspaceId } },
    select: {
      id: true, titulo: true, tipo: true, cassetteNumero: true, videoKey: true, videoBorradoAt: true, descargasExtra: true,
      proyecto: { select: { pedido: { select: { number: true, status: true, client: { select: { firstName: true, lastName: true, businessName: true } } } } } },
    },
  });
  if (!g || !g.videoKey || g.videoKey !== `${prefijoDeGrabacion(workspaceId, g.id)}final.mp4`) return { ok: false, motivo: "NO_EXISTE" };
  if (g.videoBorradoAt) return { ok: false, motivo: "BORRADO" };
  if (g.proyecto?.pedido?.status === "CANCELADO") return { ok: false, motivo: "CANCELADO" };

  const resultado = await prisma.$transaction(async (tx): Promise<"OK" | MotivoSinDescarga> => {
    // Primero el pedido y después la entrega: el mismo orden que usará quien sume un cargo al pedido
    // y toque la entrega (E6), así dos caminos no se esperan entre sí.
    await bloquearPedido(tx, e.pedidoId);
    await tx.$queryRaw`SELECT id FROM "DigitalizacionEntrega" WHERE id = ${e.id} FOR UPDATE`;
    const saldo = await saldoDeVideosMinor(tx, workspaceId, e.pedidoId);
    if (!saldo || saldo.saldoMinor > 0) return "SALDO";
    const repetida = await tx.digitalizacionDescarga.findFirst({
      where: { entregaId: e.id, grabacionId: g.id, createdAt: { gte: new Date(ahora.getTime() - SEGUNDOS_DESCARGA_REPETIDA * 1000) } },
      select: { id: true },
    });
    if (repetida) return "OK";
    const usadas = await tx.digitalizacionDescarga.count({ where: { entregaId: e.id, grabacionId: g.id } });
    if (descargasRestantes({ descargasExtra: g.descargasExtra, usadas }).quedan <= 0) return "SIN_CUPO";
    await tx.digitalizacionDescarga.create({ data: { workspaceId, entregaId: e.id, grabacionId: g.id } });
    return "OK";
  });
  if (resultado !== "OK") return { ok: false, motivo: resultado };
  const pedido = g.proyecto?.pedido;
  const nombre = nombreArchivoVideo(
    { pedidoNumero: pedido?.number ?? null, clienteNombre: nombreCliente(pedido?.client), titulo: g.titulo, tipo: g.tipo === "DVD" ? "DVD" : "VHS", cassetteNumero: g.cassetteNumero },
    "mp4",
  );
  return { ok: true, url: await urlDeVideo(g.videoKey, nombre, "descargar", segundosDeFirma(SEGUNDOS_DESCARGA, e.videosVencenAt, ahora)) };
}
