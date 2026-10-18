import "server-only";
import { prisma, Prisma } from "@repo/db";
import { buscarCobrosMp } from "@/lib/cash/mp-cobros-server";
import { candidatosDePago, VENTANA_VERIFICAR_MS, type PagoCandidato } from "./verificar-pago";

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
