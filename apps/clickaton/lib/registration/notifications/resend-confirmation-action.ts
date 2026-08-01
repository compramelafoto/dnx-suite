"use server";

import {
  resendPaymentConfirmationEmail,
  type ResendConfirmationResult,
} from "./resend-payment-confirmation";

export async function resendConfirmationEmailAction(input: {
  registrationId: string;
  accessToken: string;
  editionSlug: string;
}): Promise<ResendConfirmationResult> {
  return resendPaymentConfirmationEmail({
    ...input,
    actor: "participant",
  });
}
