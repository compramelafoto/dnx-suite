/**
 * Cobro dividido al afiliado: lo que el checkout necesita leer y anotar.
 * Todo best-effort en la lectura (ante un error, no hay reparto y la comisión
 * se paga a mano); la marca SPLIT reintenta y avisa fuerte si no pudo.
 */

import { prisma } from "@repo/db";

import {
  decideAffiliateSplit,
  type AffiliateSplitCommissionRow,
} from "../domain/affiliate-split";
import { isAffiliateSplitActive } from "./affiliate-split-flag";
import { createPrismaAffiliateConsentRepository } from "./prisma-affiliate-consent";
import { getActiveSplitReceiver } from "./split-consent";

export { isAffiliateSplitActive };

export type AffiliateSplitCheckoutPort = {
  loadCommission(registrationId: string): Promise<AffiliateSplitCommissionRow | null>;
  getActiveReceiver(
    affiliateId: string,
  ): Promise<{ receiverId: string; recipientId: string } | null>;
  /** PENDING → modo SPLIT con la orden de MP. Devuelve si quedó anotado. */
  markSplit(registrationId: string, providerOrderId: string): Promise<boolean>;
};

export function createPrismaAffiliateSplitCheckoutPort(): AffiliateSplitCheckoutPort {
  return {
    async loadCommission(registrationId) {
      try {
        const row = await prisma.clickatonAffiliateCommission.findUnique({
          where: { registrationId },
          select: {
            affiliateId: true,
            status: true,
            mode: true,
            baseAmount: true,
            commissionBps: true,
            mpFeeBps: true,
            netAmount: true,
          },
        });
        return row ? { ...row, mode: row.mode ?? null } : null;
      } catch (error) {
        console.error("[clickaton][afiliados] no se pudo leer la comisión", {
          registrationId,
          detalle: error instanceof Error ? error.message.slice(0, 160) : "unknown",
        });
        return null;
      }
    },
    getActiveReceiver(affiliateId) {
      return getActiveSplitReceiver(affiliateId, {
        repo: createPrismaAffiliateConsentRepository(),
      });
    },
    async markSplit(registrationId, providerOrderId) {
      for (let intento = 1; intento <= 2; intento++) {
        try {
          const updated = await prisma.clickatonAffiliateCommission.updateMany({
            where: { registrationId, status: "PENDING" },
            data: { mode: "SPLIT", providerOrderId },
          });
          return updated.count > 0;
        } catch (error) {
          console.error("[clickaton][afiliados] no se pudo marcar la comisión como SPLIT", {
            registrationId,
            providerOrderId,
            intento,
            detalle: error instanceof Error ? error.message.slice(0, 160) : "unknown",
          });
        }
      }
      return false;
    },
  };
}

export type RegistrationPaymentMethod = "card_brick_split" | "default";

/**
 * Qué pantalla de pago corresponde: "card_brick_split" si la inscripción
 * califica para el cobro dividido (interruptor encendido, comisión PENDING,
 * permiso ACTIVO y monto repartible); si no, "default" (lo de siempre).
 * El checkout lo vuelve a verificar al cobrar: esto no autoriza nada.
 */
export async function resolveRegistrationPaymentMethod(
  registrationId: string,
  deps: {
    port?: AffiliateSplitCheckoutPort;
    isActive?: () => boolean;
    loadTotalAmount?: (registrationId: string) => Promise<number | null>;
  } = {},
): Promise<RegistrationPaymentMethod> {
  const active = deps.isActive ?? (() => isAffiliateSplitActive());
  if (!active()) return "default";
  try {
    const port = deps.port ?? createPrismaAffiliateSplitCheckoutPort();
    const commission = await port.loadCommission(registrationId);
    if (!commission || commission.status !== "PENDING") return "default";
    const total = await (deps.loadTotalAmount ?? loadRegistrationTotalAmount)(registrationId);
    if (total == null) return "default";
    const receiver = await port.getActiveReceiver(commission.affiliateId);
    const decision = decideAffiliateSplit({
      flagEnabled: true,
      hasCardPayment: true,
      commission,
      receiver,
      totalAmountMinor: total,
    });
    return decision.split ? "card_brick_split" : "default";
  } catch (error) {
    console.error("[clickaton][afiliados] no se pudo decidir el medio de pago", {
      registrationId,
      detalle: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return "default";
  }
}

async function loadRegistrationTotalAmount(registrationId: string): Promise<number | null> {
  const row = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { totalAmount: true },
  });
  return row?.totalAmount ?? null;
}

/** Public key del Brick en producción (nunca un access token). */
export function resolveProductionCardBrickPublicKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  // Una key de prueba (TEST-) tokeniza tarjetas que producción rechaza.
  const candidates = [
    env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim(),
    env.MERCADOPAGO_LIVE_PUBLIC_KEY?.trim(),
  ];
  return candidates.find((key) => key && !key.startsWith("TEST-")) ?? null;
}
