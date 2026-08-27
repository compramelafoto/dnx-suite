"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMemberAccount } from "@/lib/membership/account";
import { selectChargesToPay } from "@/lib/membership/select-charges";
import { minorToDecimalString } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { appUrl } from "@/lib/app-url";
import { withholdingForPayment } from "@/lib/platform-fee/debt";
import { pendingFeeDebtMinor } from "@/lib/platform-fee/ledger";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export type StartDuesPaymentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

/**
 * Arranca el pago de cuotas del socio que tiene la sesión abierta.
 *
 * El socio elige **cuántas** cuotas paga, no cuáles: la selección va siempre de la más vieja
 * a la más nueva (ver `select-charges.ts`).
 *
 * Se cobra con el token de la institución —dos vías— y la plataforma retiene su comisión con
 * `marketplace_fee` en la misma operación. El dinero no pasa por DNX.
 */
export async function startDuesPaymentAction(formData: FormData): Promise<StartDuesPaymentResult> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) {
    return { ok: false, error: "No encontramos tu ficha de socio." };
  }

  const crudo = String(formData.get("howMany") ?? "ALL");
  const howMany = crudo === "ALL" ? "ALL" : Number(crudo);

  const account = await loadMemberAccount(context.member.id);
  const seleccion = selectChargesToPay(account.charges, { howMany });
  if (!seleccion.ok) {
    return { ok: false, error: seleccion.message };
  }

  const base = appUrl();
  if (!base) {
    return { ok: false, error: "Falta configurar la dirección pública de la aplicación." };
  }

  const collector = await resolveWorkspaceCollector(context.workspace.id);
  if (!collector.ok) {
    // El mensaje habla de la institución, no del socio: el socio no puede resolver esto.
    return {
      ok: false,
      error: "La institución todavía no tiene los cobros habilitados. Escribile a la Secretaría.",
    };
  }

  const feeBps = await getPlatformFeeBps(context.workspace.id, MEMBERS_MODULE_KEY);
  const propio = splitMinorByPlatformFee(seleccion.selection.totalMinor, feeBps);

  // Además de su propia comisión, este pago cobra la que quedó a deber por los cobros en
  // efectivo o por transferencia: son los únicos que pasan por Mercado Pago, así que son la
  // única vía de retención. Ver lib/platform-fee/debt.ts.
  const deudaPendiente = await pendingFeeDebtMinor(context.workspace.id);
  const reparto = withholdingForPayment({
    paymentMinor: seleccion.selection.totalMinor,
    ownFeeMinor: propio.feeMinor,
    pendingDebtMinor: deudaPendiente,
  });

  // La intención de pago se guarda ANTES de ir a MercadoPago: si el socio paga y el webhook
  // llega, tiene que haber contra qué acreditarlo. Sin esto un pago acreditado no tendría
  // dónde imputarse.
  const intento = await prisma.membershipPayment.create({
    data: {
      workspaceId: context.workspace.id,
      memberId: context.member.id,
      amountArs: minorToDecimalString(seleccion.selection.totalMinor),
      platformFeeArs: minorToDecimalString(reparto.withholdMinor),
      netAmountArs: minorToDecimalString(reparto.netMinor),
      status: "PENDIENTE",
      method: "MERCADOPAGO",
    },
    select: { id: true },
  });

  const cuantas = seleccion.selection.chargeIds.length;
  const titulo =
    cuantas === 1
      ? `Cuota ${seleccion.selection.oldestPeriod}`
      : `${cuantas} cuotas desde ${seleccion.selection.oldestPeriod}`;

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: seleccion.selection.totalMinor,
      currency: "ARS",
      description: titulo,
      externalReference: intento.id,
      idempotencyKey: randomUUID(),
      successUrl: `${base}/portal/cuotas?pago=ok`,
      pendingUrl: `${base}/portal/cuotas?pago=pendiente`,
      failureUrl: `${base}/portal/cuotas?pago=error`,
      notificationUrl: `${base}/api/payments/mp/webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: reparto.withholdMinor,
      itemId: `cuota-${context.member.memberNumber}`,
      sourceApp: "FOTOFFICE",
      metadata: {
        memberId: context.member.id,
        workspaceId: context.workspace.id,
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
