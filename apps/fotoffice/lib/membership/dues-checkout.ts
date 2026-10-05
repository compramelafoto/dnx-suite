import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { minorToDecimalString } from "./money";
import type { ChargeSelection } from "./select-charges";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { appUrl } from "@/lib/app-url";
import { withholdingForPayment } from "@/lib/platform-fee/debt";
import { pendingFeeDebtMinor } from "@/lib/platform-fee/ledger";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export type DuesCheckoutResult = { ok: true; checkoutUrl: string } | { ok: false; error: string };

/**
 * Abre el checkout de Mercado Pago para un conjunto de cuotas ya elegido.
 *
 * Se cobra con el token de la institución —dos vías— y la plataforma retiene su comisión con
 * `marketplace_fee` en la misma operación. El dinero no pasa por DNX.
 *
 * Lo usan el portal del socio y la puerta de la institución (el socio de baja que paga para
 * reactivarse). Quien llama ya resolvió QUIÉN paga desde la sesión: acá no se autoriza nada.
 */
export async function openDuesCheckout(input: {
  workspaceId: string;
  memberId: string;
  memberNumber: string;
  selection: ChargeSelection;
  /** Ruta propia a la que vuelve Mercado Pago, con `pago=ok|pendiente|error` agregado. */
  returnPath: string;
}): Promise<DuesCheckoutResult> {
  const base = appUrl();
  if (!base) {
    return { ok: false, error: "Falta configurar la dirección pública de la aplicación." };
  }

  const sep = input.returnPath.includes("?") ? "&" : "?";

  const collector = await resolveWorkspaceCollector(input.workspaceId);
  if (!collector.ok) {
    // El mensaje habla de la institución, no del socio: el socio no puede resolver esto.
    return {
      ok: false,
      error: "La institución todavía no tiene los cobros habilitados. Escribile a la Secretaría.",
    };
  }

  const feeBps = await getPlatformFeeBps(input.workspaceId, MEMBERS_MODULE_KEY);
  const propio = splitMinorByPlatformFee(input.selection.totalMinor, feeBps);

  // Además de su propia comisión, este pago cobra la que quedó a deber por los cobros en
  // efectivo o por transferencia: son los únicos que pasan por Mercado Pago, así que son la
  // única vía de retención. Ver lib/platform-fee/debt.ts.
  const deudaPendiente = await pendingFeeDebtMinor(input.workspaceId);
  const reparto = withholdingForPayment({
    paymentMinor: input.selection.totalMinor,
    ownFeeMinor: propio.feeMinor,
    pendingDebtMinor: deudaPendiente,
  });

  // La intención de pago se guarda ANTES de ir a MercadoPago: si el socio paga y el webhook
  // llega, tiene que haber contra qué acreditarlo. Sin esto un pago acreditado no tendría
  // dónde imputarse.
  const intento = await prisma.membershipPayment.create({
    data: {
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      amountArs: minorToDecimalString(input.selection.totalMinor),
      platformFeeArs: minorToDecimalString(reparto.withholdMinor),
      netAmountArs: minorToDecimalString(reparto.netMinor),
      status: "PENDIENTE",
      method: "MERCADOPAGO",
    },
    select: { id: true },
  });

  const cuantas = input.selection.chargeIds.length;
  const titulo =
    cuantas === 1
      ? `Cuota ${input.selection.oldestPeriod}`
      : `${cuantas} cuotas desde ${input.selection.oldestPeriod}`;

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: input.selection.totalMinor,
      currency: "ARS",
      description: titulo,
      externalReference: intento.id,
      idempotencyKey: randomUUID(),
      successUrl: `${base}${input.returnPath}${sep}pago=ok`,
      pendingUrl: `${base}${input.returnPath}${sep}pago=pendiente`,
      failureUrl: `${base}${input.returnPath}${sep}pago=error`,
      notificationUrl: `${base}/api/payments/mp/webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: reparto.withholdMinor,
      itemId: `cuota-${input.memberNumber}`,
      sourceApp: "FOTOFFICE",
      metadata: {
        memberId: input.memberId,
        workspaceId: input.workspaceId,
        paymentId: intento.id,
      },
    });
    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    // Se registra acá, donde ocurre: un rechazo del proveedor tiene que ser distinguible de
    // un error propio, y ese detalle ya costó dos vueltas en esta integración.
    console.error("[fotoffice][cuotas] MercadoPago rechazó la preferencia", {
      detalle: sanitizeError(error),
      paymentId: intento.id,
    });
    await prisma.membershipPayment.update({
      where: { id: intento.id },
      data: { status: "RECHAZADO" },
    });
    return { ok: false, error: "No pudimos abrir el pago. Probá de nuevo en unos minutos." };
  }
}
