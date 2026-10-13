import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { minorToDecimalString } from "@/lib/membership/money";
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
 * Abre el pago por Mercado Pago de un monto de cuotas de un socio.
 *
 * Es el cuerpo que antes vivía sólo en `startDuesPaymentAction`; se separó para que lo usen
 * también el alta sin aprobación ("Hacete VIP") y la renovación del club, sin copiarlo.
 *
 * Se cobra con el token de la institución —dos vías— y la plataforma retiene su comisión con
 * `marketplace_fee` en la misma operación. La intención de pago se guarda ANTES de ir a Mercado
 * Pago: si el webhook llega, tiene que haber contra qué acreditarlo. La imputación a cargos la
 * hace `creditMembershipPayment` al acreditar, contra los cargos abiertos en ese momento.
 */
export async function startMemberDuesCheckout(input: {
  workspaceId: string;
  memberId: string;
  memberNumber: string;
  totalMinor: number;
  title: string;
  /** A dónde vuelve la persona después de pagar, sin dominio: "/portal/cuotas". */
  returnPath: string;
}): Promise<DuesCheckoutResult> {
  const base = appUrl();
  if (!base) {
    return { ok: false, error: "Falta configurar la dirección pública de la aplicación." };
  }

  const collector = await resolveWorkspaceCollector(input.workspaceId);
  if (!collector.ok) {
    // El mensaje habla de la institución, no del socio: el socio no puede resolver esto.
    return {
      ok: false,
      error: "La institución todavía no tiene los cobros habilitados. Escribile a la Secretaría.",
    };
  }

  const feeBps = await getPlatformFeeBps(input.workspaceId, MEMBERS_MODULE_KEY);
  const propio = splitMinorByPlatformFee(input.totalMinor, feeBps);

  // Además de su propia comisión, este pago cobra la que quedó a deber por los cobros en
  // efectivo o por transferencia: son los únicos que pasan por Mercado Pago, así que son la
  // única vía de retención. Ver lib/platform-fee/debt.ts.
  const deudaPendiente = await pendingFeeDebtMinor(input.workspaceId);
  const reparto = withholdingForPayment({
    paymentMinor: input.totalMinor,
    ownFeeMinor: propio.feeMinor,
    pendingDebtMinor: deudaPendiente,
  });

  const intento = await prisma.membershipPayment.create({
    data: {
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      amountArs: minorToDecimalString(input.totalMinor),
      platformFeeArs: minorToDecimalString(reparto.withholdMinor),
      netAmountArs: minorToDecimalString(reparto.netMinor),
      status: "PENDIENTE",
      method: "MERCADOPAGO",
    },
    select: { id: true },
  });

  const vuelta = (estado: string) =>
    `${base}${input.returnPath}${input.returnPath.includes("?") ? "&" : "?"}pago=${estado}`;

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: input.totalMinor,
      currency: "ARS",
      description: input.title,
      externalReference: intento.id,
      idempotencyKey: randomUUID(),
      successUrl: vuelta("ok"),
      pendingUrl: vuelta("pendiente"),
      failureUrl: vuelta("error"),
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
