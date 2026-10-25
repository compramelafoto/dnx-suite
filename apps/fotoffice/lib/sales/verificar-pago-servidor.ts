import "server-only";
import { prisma, Prisma } from "@repo/db";
import { buscarCobrosMp } from "@/lib/cash/mp-cobros-server";
import { candidatosDePago, VENTANA_VERIFICAR_MS, type PagoCandidato } from "./verificar-pago";
import { consultarOrdenQr } from "./qr-mp-servidor";
import { medioDeOrden } from "./qr-mp";

/**
 * "Verificar pago" contra la cuenta de Mercado Pago del negocio: buscar el cobro por monto y
 * reservarlo para una sola venta. La reserva se hace en la misma acción que cobra (nunca desde el
 * navegador solo), y se vuelve a buscar en Mercado Pago: el id que manda la pantalla no alcanza.
 */

export type ResultadoBusquedaPago = { ok: true; candidatos: PagoCandidato[] } | { ok: false; error: string };

const MOTIVOS: Record<"SIN_CONEXION" | "RECONECTAR" | "ERROR_MP", string> = {
  SIN_CONEXION: "Mercado Pago no está conectado. Se conecta en Configuración → Cobros.",
  RECONECTAR: "La conexión con Mercado Pago venció. Volvé a conectarla en Configuración → Cobros.",
  ERROR_MP: "Mercado Pago no respondió. Probá de nuevo en un momento o confirmalo a ojo.",
};

export async function buscarPagosParaCobrar(workspaceId: string, montoMinor: number, ahora = new Date()): Promise<ResultadoBusquedaPago> {
  if (!Number.isInteger(montoMinor) || montoMinor <= 0) return { ok: false, error: "No hay monto para buscar." };
  const r = await buscarCobrosMp(workspaceId, new Date(ahora.getTime() - VENTANA_VERIFICAR_MS), new Date(ahora.getTime() + 60_000));
  if (!r.ok) return { ok: false, error: MOTIVOS[r.motivo] };
  const ids = r.cobros.map((c) => c.id);
  const usados = ids.length
    ? await prisma.fotofficePagoMpUsado.findMany({ where: { workspaceId, mpPaymentId: { in: ids } }, select: { mpPaymentId: true } })
    : [];
  return { ok: true, candidatos: candidatosDePago(r.cobros, montoMinor, new Set(usados.map((u) => u.mpPaymentId))) };
}

export type ReservaPago = { ok: true; reservaId: string; pago: PagoCandidato } | { ok: false; error: string };

/** Reserva el cobro para este ticket, si sigue siendo válido para ese monto. */
export async function reservarPagoMp(workspaceId: string, userId: number | null, mpPaymentId: unknown, montoMinor: number): Promise<ReservaPago> {
  if (typeof mpPaymentId !== "string" || !/^\d{1,30}$/.test(mpPaymentId)) return { ok: false, error: "El pago verificado no se entiende. Verificalo de nuevo." };
  const b = await buscarPagosParaCobrar(workspaceId, montoMinor);
  if (!b.ok) return b;
  const pago = b.candidatos.find((c) => c.id === mpPaymentId);
  if (!pago) return { ok: false, error: "Ese pago ya no coincide con el monto a cobrar o ya se usó. Verificalo de nuevo." };
  try {
    const fila = await prisma.fotofficePagoMpUsado.create({
      data: { workspaceId, mpPaymentId, montoArs: (montoMinor / 100).toFixed(2), pagador: pago.pagador, createdByUserId: userId },
      select: { id: true },
    });
    return { ok: true, reservaId: fila.id, pago };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Esa transferencia ya se usó en otro cobro." };
    }
    throw e;
  }
}

export async function confirmarUsoPagoMp(reservaId: string, usadoEn: string): Promise<void> {
  await prisma.fotofficePagoMpUsado.update({ where: { id: reservaId }, data: { usadoEn } }).catch(() => undefined);
}

/** El cobro falló: el pago queda libre para volver a usarlo. */
export async function liberarPagoMp(reservaId: string): Promise<void> {
  await prisma.fotofficePagoMpUsado.delete({ where: { id: reservaId } }).catch(() => undefined);
}

/**
 * Una order del QR del mostrador que ya se pagó: se vuelve a leer en Mercado Pago (con el token
 * de ESTE negocio, así una order ajena no aparece) y se reserva como cualquier otro pago.
 */
export async function reservarOrdenQr(workspaceId: string, userId: number | null, ordenId: unknown, montoMinor: number): Promise<ReservaPago> {
  const r = await consultarOrdenQr(workspaceId, ordenId);
  if (!r.ok) return r;
  if (r.orden.estado !== "PAGADO") return { ok: false, error: "El cobro con QR todavía no figura pagado en Mercado Pago." };
  if (r.orden.montoMinor !== montoMinor) return { ok: false, error: "El monto pagado con QR no coincide con el del ticket." };
  try {
    const fila = await prisma.fotofficePagoMpUsado.create({
      data: { workspaceId, mpPaymentId: r.orden.id, montoArs: (montoMinor / 100).toFixed(2), pagador: null, createdByUserId: userId },
      select: { id: true },
    });
    return { ok: true, reservaId: fila.id, pago: { id: r.orden.id, fecha: new Date().toISOString(), montoMinor, pagador: null, medio: medioDeOrden(r.orden.medio) } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "Ese cobro con QR ya se registró." };
    throw e;
  }
}

/** El pago que acompaña a un cobro del mostrador: verificado (transferencia) o por QR. */
export async function reservarCobroMp(
  workspaceId: string,
  userId: number | null,
  origen: { mpPaymentId?: string | null; mpOrderId?: string | null },
  montoMinor: number,
): Promise<ReservaPago | null> {
  if (origen.mpOrderId) return reservarOrdenQr(workspaceId, userId, origen.mpOrderId, montoMinor);
  if (origen.mpPaymentId) return reservarPagoMp(workspaceId, userId, origen.mpPaymentId, montoMinor);
  return null;
}
