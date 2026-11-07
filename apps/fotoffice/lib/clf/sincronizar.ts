import "server-only";
import { prisma } from "@repo/db";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { fetchMpPayment, MpReadError } from "@/lib/payments/mp/client";
import type { MpPaymentFacts } from "@/lib/payments/mp/payment-facts";
import { pedirVentas, type DepsApiClf, type VentaClf } from "./api";
import { leerLlave } from "./conexion";
import { validarVenta, type LecturaMp } from "./validacion";

/**
 * Trae las ventas de CLF de un espacio y las valida contra su Mercado Pago (etapa 2). Nunca escribe en la Caja.
 * Topes por corrida: 5 páginas de CLF, 100 validaciones nuevas y 300 revalidaciones (ventas de los últimos 180 días
 * revisadas hace más de 24 horas, para atrapar reintegros que CLF no haya avisado).
 */

export const PAGINAS_POR_CORRIDA = 5;
export const VALIDACIONES_POR_CORRIDA = 100;
export const REVALIDACIONES_POR_CORRIDA = 300;
const DIA_MS = 24 * 60 * 60 * 1000;

export const MENSAJE_LLAVE_RECHAZADA = "CompraMeLaFoto rechazó la conexión: volvé a conectarla.";
export const MENSAJE_SIN_CONEXION = "No pudimos consultar CompraMeLaFoto. Se reintenta solo en 15 minutos.";

export type DepsSincronizar = DepsApiClf & {
  ahora?: Date;
  leerLlave?: (workspaceId: string) => Promise<string | null>;
  /** Token y cuenta de Cobros del espacio; null si no tiene Mercado Pago conectado. */
  cobros?: (workspaceId: string) => Promise<{ accessToken: string; providerUserId: string } | null>;
  leerPago?: (token: string, paymentId: string) => Promise<MpPaymentFacts>;
};

export type ResultadoSincronizacion = { ok: boolean; nuevas: number; actualizadas: number; validadas: number; error: string | null };

function datosDeVenta(v: VentaClf) {
  return {
    mpPaymentId: v.mpPaymentId,
    albumId: v.album.id,
    albumTitulo: v.album.titulo,
    detalle: v.detalle,
    pagadoEl: v.pagadoEl,
    estadoClf: v.estado,
    motivo: v.motivo,
    pagoFamiliaArs: v.pagoFamilia,
    comisionPlataformaArs: v.comisionPlataforma,
    descuentoReferidosArs: v.descuentoReferidos,
    comisionOrganizadorArs: v.comisionOrganizador,
    retenidoEsperadoArs: v.retenidoEsperadoMp,
    netoFotografoArs: v.netoFotografo,
    cobrador: v.cobrador,
    cobradorMpUserId: v.cobradorMpUserId,
  };
}

async function cobrosDelEspacio(workspaceId: string) {
  const r = await resolveWorkspaceCollector(workspaceId);
  return r.ok ? { accessToken: r.collector.accessToken, providerUserId: r.collector.providerUserId } : null;
}

async function leer(deps: DepsSincronizar, token: string, paymentId: string): Promise<LecturaMp> {
  try {
    return { ok: true, facts: await (deps.leerPago ?? fetchMpPayment)(token, paymentId) };
  } catch (e) {
    if (e instanceof MpReadError && [401, 403, 404].includes(e.status)) return { ok: false, tipo: "NO_ACCESO" };
    if (e && typeof e === "object" && "status" in e && [401, 403, 404].includes((e as { status: number }).status)) return { ok: false, tipo: "NO_ACCESO" };
    return { ok: false, tipo: "TEMPORAL" };
  }
}

const n = (d: unknown): number => Number(String(d));

async function validar(workspaceId: string, ids: string[], deps: DepsSincronizar, ahora: Date): Promise<number> {
  if (ids.length === 0) return 0;
  const cobros = await (deps.cobros ?? cobrosDelEspacio)(workspaceId).catch(() => null);
  const ventas = await prisma.fotofficeClfVenta.findMany({ where: { workspaceId, id: { in: ids } } });
  let hechas = 0;
  for (const v of ventas) {
    const lectura: LecturaMp = !cobros
      ? { ok: false, tipo: "SIN_COBROS" }
      : !v.mpPaymentId
        ? { ok: false, tipo: "NO_ACCESO" }
        : await leer(deps, cobros.accessToken, v.mpPaymentId);
    const r = validarVenta(
      { clfOrderId: v.clfOrderId, pagoFamiliaArs: n(v.pagoFamiliaArs), retenidoEsperadoArs: n(v.retenidoEsperadoArs), estadoClf: v.estadoClf, cobradorMpUserId: v.cobradorMpUserId },
      lectura,
      cobros?.providerUserId ?? null,
    );
    if (r.validacion === "PENDIENTE") continue;
    await prisma.fotofficeClfVenta.update({ where: { id: v.id }, data: { ...r, mpRevisadoEl: ahora } });
    hechas++;
  }
  return hechas;
}

export async function sincronizarEspacio(workspaceId: string, deps: DepsSincronizar = {}): Promise<ResultadoSincronizacion> {
  const ahora = deps.ahora ?? new Date();
  const conexion = await prisma.fotofficeClfConexion.findUnique({ where: { workspaceId } });
  if (!conexion || conexion.cerradaEl) return { ok: false, nuevas: 0, actualizadas: 0, validadas: 0, error: null };
  const llave = await (deps.leerLlave ?? leerLlave)(workspaceId);
  if (!llave) {
    await prisma.fotofficeClfConexion.update({ where: { workspaceId }, data: { ultimoError: MENSAJE_LLAVE_RECHAZADA } });
    return { ok: false, nuevas: 0, actualizadas: 0, validadas: 0, error: MENSAJE_LLAVE_RECHAZADA };
  }

  let cursor = conexion.cursor;
  let nuevas = 0;
  let actualizadas = 0;
  let error: string | null = null;
  for (let pagina = 0; pagina < PAGINAS_POR_CORRIDA; pagina++) {
    const r = await pedirVentas(llave, cursor, deps);
    if (!r.ok) {
      error = r.codigo === "LLAVE_RECHAZADA" ? MENSAJE_LLAVE_RECHAZADA : MENSAJE_SIN_CONEXION;
      break;
    }
    for (const v of r.ventas) {
      const previa = await prisma.fotofficeClfVenta.findUnique({
        where: { workspaceId_clfOrderId: { workspaceId, clfOrderId: v.orderId } },
        select: { id: true, estadoClf: true },
      });
      if (!previa) {
        await prisma.fotofficeClfVenta.create({ data: { workspaceId, clfOrderId: v.orderId, ...datosDeVenta(v) } });
        nuevas++;
      } else {
        // Si cambió el estado en CLF (por ejemplo, un reintegro) se vuelve a validar.
        const cambio = previa.estadoClf !== v.estado;
        await prisma.fotofficeClfVenta.update({ where: { id: previa.id }, data: { ...datosDeVenta(v), ...(cambio ? { validacion: "PENDIENTE" } : {}) } });
        actualizadas++;
      }
    }
    // `siguiente` es la posición de la última venta devuelta: la próxima corrida sigue desde ahí.
    if (r.siguiente) cursor = r.siguiente;
    if (!r.hayMas || r.ventas.length === 0) break;
  }

  const pendientes = await prisma.fotofficeClfVenta.findMany({
    where: { workspaceId, validacion: "PENDIENTE" },
    orderBy: { pagadoEl: "asc" },
    take: VALIDACIONES_POR_CORRIDA,
    select: { id: true },
  });
  const viejas = await prisma.fotofficeClfVenta.findMany({
    where: {
      workspaceId,
      validacion: { not: "PENDIENTE" },
      pagadoEl: { gte: new Date(ahora.getTime() - 180 * DIA_MS) },
      OR: [{ mpRevisadoEl: null }, { mpRevisadoEl: { lt: new Date(ahora.getTime() - DIA_MS) } }],
    },
    orderBy: { mpRevisadoEl: "asc" },
    take: REVALIDACIONES_POR_CORRIDA,
    select: { id: true },
  });
  const validadas = await validar(workspaceId, [...pendientes, ...viejas].map((x) => x.id), deps, ahora);

  await prisma.fotofficeClfConexion.update({
    where: { workspaceId },
    data: { cursor, ultimaSincronizacionEl: ahora, ultimoError: error },
  });
  return { ok: error === null, nuevas, actualizadas, validadas, error };
}

/** Para el cron: todos los espacios con la conexión abierta, de a uno. Un espacio que falla no frena a los demás. */
export async function sincronizarTodos(deps: DepsSincronizar = {}): Promise<{ espacios: number; conError: number }> {
  const conexiones = await prisma.fotofficeClfConexion.findMany({ where: { cerradaEl: null }, select: { workspaceId: true } });
  let conError = 0;
  for (const c of conexiones) {
    const r = await sincronizarEspacio(c.workspaceId, deps).catch(() => ({ ok: false }));
    if (!r.ok) conError++;
  }
  return { espacios: conexiones.length, conError };
}
