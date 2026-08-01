/**
 * Contrato mínimo del cliente Resend usado por ResendProvider.
 *
 * - No importa el SDK `resend`.
 * - No lee env vars.
 * - No se inicializa en import time.
 *
 * La app (etapa futura) inyecta un adaptador compatible:
 *   createResendClientAdapter(new Resend(apiKey))
 */
export type ResendSendPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Uint8Array;
    content_id?: string;
  }>;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
};

export type ResendSendResponse = {
  data?: { id?: string } | null;
  error?: { message: string; name?: string } | null;
};

export type ResendClientLike = {
  emails: {
    send(payload: ResendSendPayload): Promise<ResendSendResponse>;
  };
};

/** Identity helper tipado para cablear un SDK compatible sin acoplar el import. */
export function createResendClientAdapter(client: ResendClientLike): ResendClientLike {
  return client;
}
