import { buildPromotionQuote } from "./calculate";
import type {
  PreviewPromotionInput,
  PreviewPromotionResult,
  PromotionRejectionCode,
  RedeemPromotionCommand,
  RedeemPromotionInput,
} from "./types";

function reject(
  code: PromotionRejectionCode,
  message: string,
): PreviewPromotionResult {
  return { ok: false, code, message };
}

/**
 * Preview / validación pura. No persiste ni consume usos.
 */
export function previewPromotion(input: PreviewPromotionInput): PreviewPromotionResult {
  const now = input.now ?? new Date();
  const promo = input.promotion;

  if (!Number.isInteger(input.originalAmount) || input.originalAmount < 0) {
    return reject("INVALID_AMOUNT", "El monto original es inválido.");
  }
  if (!input.currency?.trim()) {
    return reject("INVALID_CURRENCY", "Moneda inválida.");
  }
  if (!promo.isActive) {
    return reject("CODE_INACTIVE", "Este código no está activo.");
  }
  if (promo.startsAt.getTime() > now.getTime()) {
    return reject("CODE_NOT_STARTED", "Este código aún no está vigente.");
  }
  if (promo.endsAt.getTime() < now.getTime()) {
    return reject("CODE_EXPIRED", "Este código está vencido.");
  }
  if (promo.platform !== input.platform) {
    return reject("PLATFORM_MISMATCH", "Este código no aplica a esta plataforma.");
  }
  if (promo.editionId && promo.editionId !== (input.editionId ?? null)) {
    return reject("EDITION_MISMATCH", "Este código no aplica a esta edición.");
  }
  if (
    promo.minimumPurchaseAmount != null &&
    input.originalAmount < promo.minimumPurchaseAmount
  ) {
    return reject(
      "MINIMUM_NOT_MET",
      "No se alcanza el monto mínimo de compra para este código.",
    );
  }
  if (
    promo.discountType === "PERCENTAGE" &&
    (promo.discountValue < 1 || promo.discountValue > 100)
  ) {
    return reject("INVALID_PROMOTION", "Configuración de porcentaje inválida.");
  }
  if (
    promo.totalUsageLimit != null &&
    input.usage.totalActiveRedemptions >= promo.totalUsageLimit
  ) {
    return reject("TOTAL_LIMIT_REACHED", "Se agotaron los usos de este código.");
  }
  if (promo.perUserUsageLimit != null && input.userId != null) {
    if (input.usage.userActiveRedemptions >= promo.perUserUsageLimit) {
      return reject(
        "USER_LIMIT_REACHED",
        "Ya usaste este código el máximo de veces permitido.",
      );
    }
  }

  try {
    const quote = buildPromotionQuote({
      promotion: promo,
      originalAmount: input.originalAmount,
      currency: input.currency,
    });
    return { ok: true, quote };
  } catch {
    return reject("INVALID_PROMOTION", "No se pudo calcular el descuento.");
  }
}

export type BuildRedeemResult =
  | {
      ok: true;
      kind: "redeem";
      command: RedeemPromotionCommand;
      quote: Extract<PreviewPromotionResult, { ok: true }>["quote"];
    }
  | (Extract<PreviewPromotionResult, { ok: false }> & { kind: "reject" });

/**
 * Construye el comando de redención a partir de un preview exitoso.
 * La persistencia e idempotencia quedan en el adapter de la app.
 */
export function buildRedeemCommand(input: RedeemPromotionInput): BuildRedeemResult {
  const preview = previewPromotion(input);
  if (!preview.ok) return { ...preview, kind: "reject" };
  return {
    ok: true,
    kind: "redeem",
    quote: preview.quote,
    command: {
      promotionId: preview.quote.promotionId,
      userId: input.userId ?? null,
      registrationId: input.registrationId ?? null,
      orderId: input.orderId,
      originalAmount: preview.quote.originalAmount,
      discountAmount: preview.quote.discountAmount,
      finalAmount: preview.quote.finalAmount,
      currency: preview.quote.currency,
      platform: input.platform,
      editionId: input.editionId ?? null,
      idempotencyKey: input.idempotencyKey,
      status: "RESERVED",
    },
  };
}

export function createPromotionEngine() {
  return {
    preview: previewPromotion,
    buildRedeemCommand,
  };
}
