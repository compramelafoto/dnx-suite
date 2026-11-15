import { isIntlPilotUser } from "./pilot";
import { getWalletState, recordTopUp } from "./wallet-store";
import { splitTopUpPayment, suggestTopUp, topUpCharge, validateTopUp } from "./wallet";
import { captureTopUpOrder, createTopUpOrder, isPaypalDnxConfigured, parseCustomId } from "./paypal-dnx";

function appUrl(): string {
  return process.env.APP_URL || "https://compramelafoto.com";
}

export const SALDO_PANEL_PATH = "/fotografo/configuracion?tab=saldo";

/** Estado del saldo para el panel del fotógrafo. */
export async function walletView(userId: number) {
  const w = await getWalletState(userId);
  return {
    balanceUsdCents: w.balanceUsdCents,
    advanceDebtUsdCents: w.advanceDebtUsdCents,
    last30DaysCommissionUsdCents: w.last30DaysCommissionUsdCents,
    suggestion: suggestTopUp(w.last30DaysCommissionUsdCents),
    movements: w.movements.slice(0, 50).map((m) => ({
      id: m.id,
      type: m.type,
      amountUsdCents: m.amountUsdCents,
      orderId: m.orderId,
      localCurrency: m.localCurrency,
      localAmount: m.localAmount,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function startTopUp(
  userId: number,
  chosenUsdCents: number,
): Promise<{ ok: true; approveUrl: string } | { ok: false; status: number; error: string }> {
  if (!isIntlPilotUser(userId)) return { ok: false, status: 404, error: "No disponible." };
  if (!isPaypalDnxConfigured()) return { ok: false, status: 503, error: "Las recargas todavía no están disponibles." };
  const valid = validateTopUp(chosenUsdCents);
  if (!valid.ok) return { ok: false, status: 400, error: valid.message };
  const { advanceDebtUsdCents } = await getWalletState(userId);
  const { approveUrl } = await createTopUpOrder({
    amountUsdCents: topUpCharge(chosenUsdCents, advanceDebtUsdCents),
    userId,
    chosenUsdCents,
    returnUrl: `${appUrl()}/api/fotografo/saldo-internacional/paypal-retorno`,
    cancelUrl: `${appUrl()}${SALDO_PANEL_PATH}&recarga=cancelada`,
  });
  return { ok: true, approveUrl };
}

/** Confirma la recarga al volver de PayPal. Devuelve el resultado para la redirección. */
export async function finishTopUp(
  sessionUserId: number,
  paypalOrderId: string,
): Promise<"ok" | "error"> {
  if (!isIntlPilotUser(sessionUserId) || !paypalOrderId) return "error";
  const capture = await captureTopUpOrder(paypalOrderId);
  const custom = parseCustomId(capture.customId);
  if (capture.status === "FAILED" || !capture.captureId || !custom || custom.userId !== sessionUserId) {
    console.error("[intl-topup] captura no válida", {
      sessionUserId,
      paypalOrderId,
      status: capture.status,
      customUserId: custom?.userId ?? null,
    });
    return "error";
  }
  const { advanceDebtUsdCents } = await getWalletState(sessionUserId);
  const split = splitTopUpPayment(capture.paidUsdCents, advanceDebtUsdCents);
  await recordTopUp({
    userId: sessionUserId,
    captureId: capture.captureId,
    paidUsdCents: capture.paidUsdCents,
    creditUsdCents: split.creditUsdCents,
    advanceRepaidUsdCents: split.advanceRepaidUsdCents,
  });
  return "ok";
}
