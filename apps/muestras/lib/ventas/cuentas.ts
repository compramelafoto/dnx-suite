import "server-only";
import { prisma } from "@repo/db";
import { CONSENT_STATUSES, type ConsentStatus } from "@repo/muestras";
import { leerConsentimiento } from "./mp";

/**
 * Cuentas de cobro (etapa 8, spec D13): una fila por persona y ambiente con la última lectura del
 * consentimiento de reparto de Mercado Pago. Consultas de servidor: no son acciones (un archivo
 * `"use server"` expondría cualquier función exportada como acción que se puede llamar desde afuera).
 */
export type AmbienteCuenta = "SANDBOX" | "PRODUCTION";

export const CONSENT_TEXTOS: Record<ConsentStatus, string> = {
  NONE: "Todavía no conectaste tu Mercado Pago.",
  PENDING: "Falta que aceptes en Mercado Pago.",
  ACTIVE: "Listo: vas a recibir tu parte en",
  REJECTED: "Mercado Pago dice que no está aceptado: volvé a pedirlo.",
  CANCELED: "Mercado Pago dice que no está aceptado: volvé a pedirlo.",
  EXPIRED: "Mercado Pago dice que no está aceptado: volvé a pedirlo.",
};

/** Lo que dice Mercado Pago, en uno de nuestros estados (lo desconocido queda como pendiente). */
export function estadoDeConsentimiento(s: string | null | undefined): ConsentStatus {
  const v = (s ?? "").toUpperCase();
  return (CONSENT_STATUSES as readonly string[]).includes(v) ? (v as ConsentStatus) : "PENDING";
}

const CUENTA = {
  id: true, userId: true, environment: true, mpEmail: true, receiverId: true, consentStatus: true, inviteUrl: true, lastCheckedAt: true,
} as const;

export type CuentaDeCobro = {
  id: string;
  userId: number;
  environment: string;
  mpEmail: string;
  receiverId: string | null;
  consentStatus: string;
  inviteUrl: string | null;
  lastCheckedAt: Date | null;
};

export async function cuentaDeCobro(userId: number, ambiente: AmbienteCuenta): Promise<CuentaDeCobro | null> {
  return prisma.culturalPayoutAccount.findUnique({ where: { userId_environment: { userId, environment: ambiente } }, select: CUENTA });
}

export const CONSENTIMIENTO_MAX_EDAD_MS = 10 * 60_000;

/**
 * El consentimiento de esa persona en ese ambiente. Si la última lectura tiene más de `maxEdadMs`,
 * vuelve a preguntar a Mercado Pago y guarda la respuesta (lo usa el pago, D13). Si Mercado Pago no
 * responde, devuelve lo guardado con `verificado: false`: quien llama decide si alcanza.
 */
export async function consentimientoVigente(
  userId: number,
  ambiente: AmbienteCuenta,
  { maxEdadMs = CONSENTIMIENTO_MAX_EDAD_MS, ahora = new Date() }: { maxEdadMs?: number; ahora?: Date } = {},
): Promise<{ status: ConsentStatus; receiverId: string | null; verificado: boolean }> {
  const c = await cuentaDeCobro(userId, ambiente);
  if (!c) return { status: "NONE", receiverId: null, verificado: true };
  const guardado = estadoDeConsentimiento(c.consentStatus);
  if (!c.receiverId) return { status: guardado, receiverId: null, verificado: true };
  const fresca = c.lastCheckedAt != null && ahora.getTime() - c.lastCheckedAt.getTime() <= maxEdadMs;
  if (fresca) return { status: guardado, receiverId: c.receiverId, verificado: true };
  const leido = await leerConsentimiento(c.receiverId);
  if (!leido) return { status: guardado, receiverId: c.receiverId, verificado: false };
  const status = estadoDeConsentimiento(leido.status);
  await prisma.culturalPayoutAccount.updateMany({
    where: { id: c.id },
    data: { consentStatus: status, lastCheckedAt: ahora, ...(leido.inviteUrl ? { inviteUrl: leido.inviteUrl } : {}) },
  });
  return { status, receiverId: c.receiverId, verificado: true };
}
