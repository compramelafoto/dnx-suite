import { CommunicationError } from "../../shared/errors";

export type SafeUrlOptions = {
  /** Permite http: (solo tests / desarrollo). Default false. */
  allowHttp?: boolean;
};

/**
 * Valida URLs de CTA. Rechaza javascript:, data: y protocolos desconocidos.
 * Devuelve la URL normalizada (href) o lanza CommunicationError UNSAFE_URL.
 */
export function assertSafeUrl(raw: string, options: SafeUrlOptions = {}): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CommunicationError("UNSAFE_URL", "URL vacía no permitida.");
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    throw new CommunicationError(
      "UNSAFE_URL",
      "Protocolo de URL no permitido.",
      { protocol: lower.split(":")[0] ?? "unknown" },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new CommunicationError(
      "UNSAFE_URL",
      "URL inválida o no absoluta.",
    );
  }

  const protocol = parsed.protocol.toLowerCase();
  const httpsOk = protocol === "https:";
  const httpOk = protocol === "http:" && options.allowHttp === true;

  if (!httpsOk && !httpOk) {
    throw new CommunicationError(
      "UNSAFE_URL",
      `Protocolo no permitido: "${protocol}". Usá https:${options.allowHttp ? " o http: (allowHttp)" : ""}.`,
      { protocol },
    );
  }

  return parsed.toString();
}

export function trySafeUrl(
  raw: string | undefined,
  options: SafeUrlOptions = {},
): string | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  return assertSafeUrl(raw, options);
}
