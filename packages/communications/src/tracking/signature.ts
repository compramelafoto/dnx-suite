import type {
  WebhookSignatureVerifier,
  WebhookVerificationResult,
} from "./contracts";
import { getHeader } from "./sanitize";

/**
 * Verifier falso para tests / smoke local.
 * No realiza criptografía real.
 */
export function createFakeWebhookSignatureVerifier(options: {
  valid?: boolean;
  code?: WebhookVerificationResult extends { ok: false }
    ? WebhookVerificationResult["code"]
    : never;
}): WebhookSignatureVerifier {
  const valid = options.valid !== false;
  return {
    async verify(input): Promise<WebhookVerificationResult> {
      const id = getHeader(input.headers, "svix-id");
      const timestamp = getHeader(input.headers, "svix-timestamp");
      const signature = getHeader(input.headers, "svix-signature");
      if (!id || !timestamp || !signature) {
        return {
          ok: false,
          code: "WEBHOOK_SIGNATURE_MISSING",
          message: "Faltan headers svix-id / svix-timestamp / svix-signature.",
        };
      }
      if (!valid) {
        return {
          ok: false,
          code: options.code ?? "WEBHOOK_SIGNATURE_INVALID",
          message: "Firma inválida (fake verifier).",
        };
      }
      return { ok: true };
    },
  };
}
