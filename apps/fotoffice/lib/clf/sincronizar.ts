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
 * Topes por corrida: 5 páginas de CLF, 60 validaciones nuevas y 60 revalidaciones (ventas de los últimos 180 días
 * revisadas hace más de 24 horas, para atrapar reintegros que CLF no haya avisado). Con 96 corridas por día alcanza
 * para revisar miles de ventas sin que una corrida se pase de tiempo.
 */

export const PAGINAS_POR_CORRIDA = 5;
export const VALIDACIONES_POR_CORRIDA = 60;
export const REVALIDACIONES_POR_CORRIDA = 60;
/** Presupuesto del cron (la función tiene 300 s): pasado este tiempo no arranca otro espacio. */
export const PRESUPUESTO_CRON_MS = 200_000;
const DIA_MS = 24 * 60 * 60 * 1000;

export const MENSAJE_LLAVE_RECHAZADA = "CompraMeLaFoto rechazó la conexión: volvé a conectarla.";
export const MENSAJE_SIN_CONEXION = "No pudimos consultar CompraMeLaFoto. Se reintenta solo en 15 minutos.";

export type DepsSincronizar = DepsApiClf & {
  ahora?: Date;
  /** Topes de esta corrida (por ejemplo, más chicos en la primera sincronización al conectar). */
  topes?: { validaciones?: number; revalidaciones?: number };
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

/** null: el espacio no tiene Cobros conectado. Lanza si la falla es pasajera (para no marcar nada como «no está»). */
async function cobrosDelEspacio(workspaceId: string) {
  const r = await resolveWorkspaceCollector(workspaceId);
  if (r.ok) return { accessToken: r.collector.accessToken, providerUserId: r.collector.providerUserId };
  if (r.code === "REFRESH_FAILED") throw new Error("Cobros: no se pudo renovar el acceso a Mercado Pago");
  return null;
}

async function leer(deps: DepsSincronizar, token: string, paymentId: string): Promise<LecturaMp> {
  try {
    return { ok: true, facts: await (deps.leerPago ?? fetchMpPayment)(token, paymentId) };
  } catch (e) {
    // 403/404: el pago no es de esta cuenta. 401 es el token (vencido o revocado): se reintenta.
    const status = e instanceof MpReadError ? e.status : e && typeof e === "object" && "status" in e ? (e as { status: number }).status : null;
    if (status === 403 || status === 404) return { ok: false, tipo: "NO_ACCESO" };
    return { ok: false, tipo: "TEMPORAL" };
  }
}

const n = (d: unknown): number => Number(String(d));

async function validar(workspaceId: string, ids: string[], deps: DepsSincronizar, ahora: Date): Promise<number> {
  if (ids.length === 0) return 0;
  let cobros: { accessToken: string; providerUserId: string } | null;
  try {
    cobros = await (deps.cobros ?? cobrosDelEspacio)(workspaceId);
  } catch {
    return 0; // Falla pasajera de Cobros: todo queda como estaba hasta la próxima corrida.
  }
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
        try {
          await prisma.fotofficeClfVenta.create({ data: { workspaceId, clfOrderId: v.orderId, ...datosDeVenta(v) } });
          nuevas++;
        } catch (e) {
          // Otra sincronización del mismo espacio la creó recién (cron y «Actualizar ahora» a la vez): se actualiza.
          if ((e as { code?: string })?.code !== "P2002") throw e;
          await prisma.fotofficeClfVenta.update({ where: { workspaceId_clfOrderId: { workspaceId, clfOrderId: v.orderId } }, data: datosDeVenta(v) });
          actualizadas++;
        }
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
    take: deps.topes?.validaciones ?? VALIDACIONES_POR_CORRIDA,
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
    take: deps.topes?.revalidaciones ?? REVALIDACIONES_POR_CORRIDA,
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
  // Primero los que hace más tiempo que no se sincronizan: si la corrida se queda sin tiempo, nadie queda siempre último.
  const conexiones = await prisma.fotofficeClfConexion.findMany({
    where: { cerradaEl: null },
    select: { workspaceId: true },
    orderBy: { ultimaSincronizacionEl: { sort: "asc", nulls: "first" } },
  });
  const inicio = Date.now();
  let conError = 0;
  for (const c of conexiones) {
    if (Date.now() - inicio > PRESUPUESTO_CRON_MS) break;
    const r = await sincronizarEspacio(c.workspaceId, deps).catch(() => ({ ok: false }));
    if (!r.ok) conError++;
  }
  return { espacios: conexiones.length, conError };
}
