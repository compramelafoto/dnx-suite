import { resolveEmailConfig } from "./email-config";
import { DETAIL_MAX } from "./constants";

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

export type OutboundEmail = {
  /** Un único destinatario. La API acepta varios; esta capa no, a propósito. */
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Nombre visible del remitente (opcional). Reemplaza el nombre configurado y conserva la
   * casilla de `FOTOFFICE_NOTIFICATIONS_FROM`: la dirección sigue saliendo sólo del entorno.
   */
  fromName?: string;
  /** "Responder a" (opcional): una sola dirección. */
  replyTo?: string;
};

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

/** Casilla del remitente configurado: lo de adentro de `<…>` o el valor pelado. */
function senderAddress(from: string): string {
  const m = from.match(/<([^<>]+)>\s*$/);
  return (m ? m[1]! : from).trim();
}

/**
 * Nombre visible seguro para la cabecera: sin comillas, `<>`, barras ni saltos de línea (que
 * permitirían inyectar cabeceras o una casilla distinta), en una línea y truncado.
 */
function safeDisplayName(name: string): string {
  return name.replace(/["<>\\\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Remitente final: el configurado, o su casilla con el nombre visible pedido. */
export function buildFrom(configuredFrom: string, fromName?: string): string {
  const name = fromName ? safeDisplayName(fromName) : "";
  return name ? `"${name}" <${senderAddress(configuredFrom)}>` : configuredFrom;
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
      body: JSON.stringify({
        from: buildFrom(from, message.fromName),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
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
