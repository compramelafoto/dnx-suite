/**
 * Adapter concreto del SDK oficial `resend` → ResendClientLike.
 *
 * Junto con `tracking/resend/verifier.ts`, es uno de los únicos módulos
 * que importan el SDK. No exportar desde el entrypoint raíz; usar subpath
 * `@repo/communications/email/resend-sdk` o createResendEmailRuntime.
 */
import { Resend } from "resend";
import type {
  ResendClientLike,
  ResendSendPayload,
  ResendSendResponse,
} from "./resend-client";

/** Superficie mínima del SDK usada por el adapter (testeable sin red). */
export type ResendSdkEmailsApi = {
  send(payload: object): Promise<{
    data: { id: string } | null;
    error: { message: string; name?: string } | null;
  }>;
};

export type ResendSdkLike = {
  emails: ResendSdkEmailsApi;
};

function sanitizeProviderMessage(message: string): string {
  return message.replace(/re_[a-zA-Z0-9_]+/g, "[redacted]").slice(0, 180);
}

/**
 * Traduce contrato interno al SDK y normaliza la respuesta.
 */
export class ResendSdkClientAdapter implements ResendClientLike {
  readonly emails: ResendClientLike["emails"];

  constructor(private readonly sdk: ResendSdkLike) {
    this.emails = {
      send: async (payload: ResendSendPayload): Promise<ResendSendResponse> => {
        const body: Record<string, unknown> = {
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
        };
        if (payload.html !== undefined) body.html = payload.html;
        if (payload.text !== undefined) body.text = payload.text;
        if (payload.reply_to !== undefined) body.replyTo = payload.reply_to;
        if (payload.cc !== undefined) body.cc = payload.cc;
        if (payload.bcc !== undefined) body.bcc = payload.bcc;
        if (payload.attachments !== undefined) {
          body.attachments = payload.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            contentId: attachment.content_id,
          }));
        }
        if (payload.tags !== undefined) body.tags = payload.tags;
        if (payload.headers !== undefined) body.headers = payload.headers;

        const result = await this.sdk.emails.send(body);
        return {
          data: result.data ? { id: result.data.id } : null,
          error: result.error
            ? {
                message: sanitizeProviderMessage(result.error.message),
                name: result.error.name,
              }
            : null,
        };
      },
    };
  }
}

/** Crea adapter con SDK oficial a partir de API key (no lee env). */
export function createResendSdkClientFromApiKey(apiKey: string): ResendClientLike {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key vacía para ResendSdkClientAdapter.");
  }
  // Cast: el SDK tipa CreateEmailOptions; nosotros enviamos el subset mapeado.
  return new ResendSdkClientAdapter(new Resend(trimmed) as unknown as ResendSdkLike);
}

/** Factory de test: inyecta un SDK falso. */
export function createResendSdkClientAdapter(sdk: ResendSdkLike): ResendClientLike {
  return new ResendSdkClientAdapter(sdk);
}
