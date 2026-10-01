"use server";

import {
  mapMercadoPagoStatusDetailToUserMessage,
  mapProviderOrderStatusToCardUiState,
  sanitizeCardPaymentSubmissionForLog,
  type CardPaymentSubmission,
} from "@repo/payments/frontend";
import { checkoutFailure, checkoutSuccess, type CheckoutActionState } from "./action-result";
import { getCheckoutServiceReady } from "./runtime";
import { resolveRegistrationPaymentMethod } from "@/lib/affiliates/infrastructure/affiliate-split-checkout";
import { isClickatonCardBrickCheckoutEnabled } from "../card-brick-enabled";
import type { CardPaymentCheckoutResultDto } from "../domain/types";

export type SubmitRegistrationCardPaymentInput = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  cardPayment: CardPaymentSubmission;
  /** Display-only; ignored for charge amount (tamper detection). */
  clientDisplayedAmountMinor?: number;
};

function redirectForUi(
  editionSlug: string,
  registrationId: string,
  accessToken: string,
  ui: "APPROVED" | "PROCESSING" | "REJECTED" | "ERROR",
): string {
  const q = new URLSearchParams({
    registrationId,
    t: accessToken,
  });
  if (ui === "APPROVED") {
    return `/maratones/${editionSlug}/inscripcion/pago/exito?${q}`;
  }
  if (ui === "REJECTED" || ui === "ERROR") {
    return `/maratones/${editionSlug}/inscripcion/pago/error?${q}`;
  }
  return `/maratones/${editionSlug}/inscripcion/pago/pendiente?${q}`;
}

/**
 * Server action: Brick token → DNX Payments Orders 1:N.
 * Reconstructs price server-side. Never logs card token.
 */
export async function submitRegistrationCardPaymentAction(
  input: SubmitRegistrationCardPaymentInput,
): Promise<CheckoutActionState<CardPaymentCheckoutResultDto>> {
  try {
    // Brick habilitado por los flags de prueba (Orders TEST) o, en producción,
    // porque esta inscripción califica para el cobro dividido al afiliado
    // (se verifica acá, en el servidor; el checkout lo vuelve a verificar).
    const cardAllowed =
      isClickatonCardBrickCheckoutEnabled() ||
      (await resolveRegistrationPaymentMethod(input.registrationId)) === "card_brick_split";
    if (!cardAllowed) {
      return checkoutFailure(
        new Error("CARD_BRICK_FLAG_OFF: Orders 1:N Brick path is not enabled"),
      );
    }

    // Safe audit — no token / PAN / CVV / full device session
    console.info(
      JSON.stringify({
        event: "card_payment_submit",
        source: "CARD_BRICK_BROWSER",
        registrationId: input.registrationId,
        ...sanitizeCardPaymentSubmissionForLog(input.cardPayment),
      }),
    );

    // Ready: en producción calienta el OAuth del collector antes de cobrar.
    const data = await (await getCheckoutServiceReady()).createCheckout({
      registrationId: input.registrationId,
      editionSlug: input.editionSlug,
      accessToken: input.accessToken,
      cardPayment: input.cardPayment,
      clientDisplayedAmountMinor: input.clientDisplayedAmountMinor,
    });

    const statusDetail = data.statusDetail ?? null;

    const uiState = mapProviderOrderStatusToCardUiState(data.status);
    const userMessage = mapMercadoPagoStatusDetailToUserMessage(statusDetail, {
      fallback:
        uiState === "APPROVED"
          ? "Tu pago fue acreditado correctamente."
          : uiState === "PROCESSING"
            ? "Estamos procesando tu pago. No vuelvas a pagar."
            : uiState === "REJECTED"
              ? "El pago fue rechazado. Podés intentar con otra tarjeta."
              : "No pudimos completar el pago.",
    });

    const dto: CardPaymentCheckoutResultDto = {
      registrationId: data.registrationId,
      paymentOrderId: data.paymentOrderId,
      providerOrderId: null,
      amountMinor: data.amountMinor,
      currency: "ARS",
      status: data.status,
      uiState,
      statusDetail,
      userMessage,
      redirectPath: redirectForUi(
        input.editionSlug,
        input.registrationId,
        input.accessToken,
        uiState,
      ),
      reused: data.reused,
    };

    return checkoutSuccess(dto);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "card_payment_failed",
        registrationId: input.registrationId,
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      }),
    );
    return checkoutFailure(error);
  }
}
