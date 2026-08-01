/**
 * Adapter de verificación de firma Resend (Svix vía SDK oficial).
 * Único módulo de tracking que puede importar `resend`.
 * Exportar solo vía `@repo/communications/tracking/resend`.
 */
import { Resend } from "resend";
import type {
  WebhookSignatureVerifier,
  WebhookVerificationResult,
} from "../contracts";
import { getHeader } from "../sanitize";

/**
 * Contrato mínimo del verify del SDK (inyectable en tests).
 * Firma real del SDK:
 *   webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret })
 */
export type ResendWebhookVerifyApi = {
  verify(input: {
    payload: string;
    headers: { id: string; timestamp: string; signature: string };
    webhookSecret: string;
  }): unknown;
};

export type CreateResendSdkWebhookSignatureVerifierOptions = {
  secret: string;
  /**
   * Tolerancia documentada (Svix default ~5m).
   * El SDK actual no expone el parámetro; se guarda para futuras versiones / docs.
   */
  toleranceSeconds?: number;
  /** Inyectar API de verify (tests). Si se omite, usa Resend.webhooks.verify. */
  verifyApi?: ResendWebhookVerifyApi;
};

function mapVerifyError(error: unknown): WebhookVerificationResult {
  const message =
    error instanceof Error ? error.message : "Verificación de firma fallida";
  const lower = message.toLowerCase();
  if (lower.includes("timestamp") || lower.includes("expired")) {
    return {
      ok: false,
      code: "WEBHOOK_SIGNATURE_EXPIRED",
      message: "Firma webhook vencida o timestamp fuera de tolerancia.",
    };
  }
  return {
    ok: false,
    code: "WEBHOOK_SIGNATURE_INVALID",
    message: "Firma webhook inválida.",
  };
}

/**
 * Verifier real basado en utilidad oficial `resend.webhooks.verify`.
 * Requiere body crudo + headers svix-*.
 */
export function createResendSdkWebhookSignatureVerifier(
  options: CreateResendSdkWebhookSignatureVerifierOptions,
): WebhookSignatureVerifier {
  const secret = options.secret.trim();
  const verifyApi =
    options.verifyApi ??
    (() => {
      // API key no se usa en verify; placeholder para instanciar el cliente SDK.
      const client = new Resend("re_webhook_verify_placeholder");
      return {
        verify: (input: {
          payload: string;
          headers: { id: string; timestamp: string; signature: string };
          webhookSecret: string;
        }) =>
          client.webhooks.verify({
            payload: input.payload,
            headers: input.headers,
            webhookSecret: input.webhookSecret,
          }),
      } satisfies ResendWebhookVerifyApi;
    })();

  return {
    async verify(input): Promise<WebhookVerificationResult> {
      if (!secret) {
        return {
          ok: false,
          code: "WEBHOOK_CONFIGURATION_MISSING",
          message: "RESEND_WEBHOOK_SECRET ausente.",
        };
      }

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

      try {
        verifyApi.verify({
          payload: input.payload,
          headers: { id, timestamp, signature },
          webhookSecret: secret,
        });
        return { ok: true };
      } catch (error) {
        return mapVerifyError(error);
      }
    },
  };
}
