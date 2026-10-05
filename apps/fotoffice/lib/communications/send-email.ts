import { resolveEmailConfig } from "./email-config";
import { DETAIL_MAX } from "./constants";
import { buildFromHeader, type WorkspaceSender } from "./sender-name";

/**
 * Transporte único de emails transaccionales de FotoOffice.
 *
 * Todo lo que sale de la aplicación pasa por acá: el email de inscripción a cursos y la
 * prueba de configuración. Ese es el punto — si la prueba usara un camino propio no
 * probaría nada sobre el envío real.
 *
 * Nunca lanza: traduce cualquier desenlace a un resultado tipado, para que el llamador
 * decida qué mostrar y qué registrar.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";

export type OutboundEmail = {
  /** Un único destinatario. La API acepta varios; esta capa no, a propósito. */
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Remitente de la institución (`loadWorkspaceSender`): el nombre visible pasa a ser el suyo y
   * las respuestas van a su casilla. Sin esto sale con el remitente del entorno.
   */
  sender?: WorkspaceSender | null;
  /** Cabeceras extra, p. ej. `List-Unsubscribe` en los envíos a muchos socios. */
  headers?: Record<string, string>;
};

/** Lo que Resend recibe por cada correo: el mismo cuerpo para el envío suelto y el de a tandas. */
function providerPayload(message: OutboundEmail, envFrom: string) {
  const payload: Record<string, unknown> = {
    from: buildFromHeader(envFrom, message.sender?.name),
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.sender?.replyTo) payload.reply_to = [message.sender.replyTo];
  if (message.headers && Object.keys(message.headers).length > 0) payload.headers = message.headers;
  return payload;
}

export type SendOutcome =
  | { status: "SENT"; providerId: string | null }
  | { status: "CONFIGURATION_ERROR"; detail: string }
  | { status: "PROVIDER_REJECTED"; detail: string }
  | { status: "INTERNAL_ERROR"; detail: string };

export type SendDeps = {
  env?: Record<string, string | undefined>;
  /** Inyectable para los tests: así se ejercita todo el módulo sin tocar la red. */
  fetchImpl?: typeof fetch;
};

/**
 * Deja el detalle en condiciones de ser guardado: sin claves, en una línea y truncado.
 *
 * El `apiKey` se pasa aparte para poder tacharlo aunque el proveedor lo devuelva dentro de
 * su propio mensaje de error, que es justo lo que hace Resend ante un 401.
 */
function sanitizeDetail(raw: string, apiKey?: string): string {
  let out = raw.replace(/\s+/g, " ").trim();
  if (apiKey) out = out.split(apiKey).join("[redactado]");
  // Cinturón y tiradores: cualquier cosa con forma de clave de Resend, venga de donde venga.
  out = out.replace(/re_[A-Za-z0-9_-]{8,}/g, "[redactado]");
  return out.length > DETAIL_MAX ? `${out.slice(0, DETAIL_MAX - 1)}…` : out;
}

/**
 * Extrae SOLO los campos que Resend documenta para sus errores. Un cuerpo que no es JSON
 * (una página HTML de un proxy, por ejemplo) se descarta entero: queda el código HTTP y
 * nada más. Guardar el cuerpo crudo puede arrastrar datos de infraestructura.
 */
function describeRejection(httpStatus: number, body: string, apiKey: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return sanitizeDetail(`HTTP ${httpStatus}`, apiKey);
  }
  if (!parsed || typeof parsed !== "object") {
    return sanitizeDetail(`HTTP ${httpStatus}`, apiKey);
  }
  const record = parsed as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : null;
  const message = typeof record.message === "string" ? record.message : null;
  const parts = [`HTTP ${httpStatus}`, name, message].filter(Boolean);
  return sanitizeDetail(parts.join(" · "), apiKey);
}

export async function sendTransactionalEmail(
  message: OutboundEmail,
  deps: SendDeps = {},
): Promise<SendOutcome> {
  const config = resolveEmailConfig(deps.env ?? process.env);
  if (!config.ok) {
    return {
      status: "CONFIGURATION_ERROR",
      detail: `Faltan variables de entorno: ${config.missing.join(", ")}`,
    };
  }

  const { apiKey, from } = config.config;
  const doFetch = deps.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(providerPayload(message, from)),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "error desconocido";
    return { status: "INTERNAL_ERROR", detail: sanitizeDetail(reason, apiKey) };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { status: "PROVIDER_REJECTED", detail: describeRejection(response.status, body, apiKey) };
  }

  try {
    const payload = (await response.json()) as { id?: unknown };
    return { status: "SENT", providerId: typeof payload.id === "string" ? payload.id : null };
  } catch {
    // El proveedor aceptó; que no podamos leer el id no convierte el envío en un fallo.
    return { status: "SENT", providerId: null };
  }
}

export type BatchOutcome =
  /** Un id por correo, en el mismo orden (null si el proveedor no lo devolvió). */
  | { status: "SENT"; providerIds: (string | null)[] }
  | { status: "CONFIGURATION_ERROR"; detail: string }
  | { status: "PROVIDER_REJECTED"; detail: string }
  | { status: "INTERNAL_ERROR"; detail: string };

/** Tope de Resend por llamada al envío de a tandas. */
export const BATCH_MAX = 100;

/**
 * Envío de a tandas (hasta 100 correos por llamada), para los envíos a muchos socios.
 *
 * Mismo contrato que el envío suelto: nunca lanza. La tanda entra o falla entera. Con
 * `idempotencyKey`, si la misma tanda se reintenta dentro de las 24 h Resend no la repite.
 */
export async function sendBatchEmails(
  messages: OutboundEmail[],
  options: { idempotencyKey?: string } = {},
  deps: SendDeps = {},
): Promise<BatchOutcome> {
  if (messages.length === 0) return { status: "SENT", providerIds: [] };
  if (messages.length > BATCH_MAX) {
    return { status: "INTERNAL_ERROR", detail: `Una tanda admite hasta ${BATCH_MAX} correos.` };
  }
  const config = resolveEmailConfig(deps.env ?? process.env);
  if (!config.ok) {
    return {
      status: "CONFIGURATION_ERROR",
      detail: `Faltan variables de entorno: ${config.missing.join(", ")}`,
    };
  }

  const { apiKey, from } = config.config;
  const doFetch = deps.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await doFetch(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(messages.map((m) => providerPayload(m, from))),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "error desconocido";
    return { status: "INTERNAL_ERROR", detail: sanitizeDetail(reason, apiKey) };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { status: "PROVIDER_REJECTED", detail: describeRejection(response.status, body, apiKey) };
  }

  try {
    const payload = (await response.json()) as { data?: { id?: unknown }[] };
    const data = Array.isArray(payload.data) ? payload.data : [];
    return {
      status: "SENT",
      providerIds: messages.map((_, i) => (typeof data[i]?.id === "string" ? (data[i].id as string) : null)),
    };
  } catch {
    return { status: "SENT", providerIds: messages.map(() => null) };
  }
}
