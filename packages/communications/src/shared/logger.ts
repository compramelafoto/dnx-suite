import type { CommunicationLog, CommunicationMetadata } from "./types";
import type { CommunicationChannel } from "./channels";

export type CommunicationLogLevel = CommunicationLog["level"];

export interface CommunicationLogger {
  debug(message: string, metadata?: CommunicationMetadata): void;
  info(message: string, metadata?: CommunicationMetadata): void;
  warn(message: string, metadata?: CommunicationMetadata): void;
  error(message: string, metadata?: CommunicationMetadata): void;
  entries(): readonly CommunicationLog[];
}

export type CreateLoggerOptions = {
  channel?: CommunicationChannel;
  provider?: string;
  /** Si true, también escribe a console (útil en desarrollo). Default false. */
  mirrorToConsole?: boolean;
};

/** Claves / patrones que no deben persistirse en logs. */
const SENSITIVE_KEY_PATTERN =
  /^(api[_-]?key|token|secret|password|authorization|auth|cookie|html|text|body|content|attachment|attachments|email|phone|pushToken|signedUrl|url|link)$/i;

function createId(): string {
  return `clog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Elimina campos sensibles de metadata antes de loguear.
 * No garantiza privacidad perfecta: las apps deben no pasar PII.
 */
export function sanitizeLogMetadata(
  metadata?: CommunicationMetadata,
): CommunicationMetadata | undefined {
  if (!metadata) return undefined;
  const clean: CommunicationMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (typeof value === "string" && value.length > 200) {
      clean[key] = `[redacted:${value.length}chars]`;
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/**
 * Logger en memoria para la fundación.
 * Inyectable en tests; sin side effects de red.
 */
export function createCommunicationLogger(
  options: CreateLoggerOptions = {},
): CommunicationLogger {
  const store: CommunicationLog[] = [];

  const write = (
    level: CommunicationLogLevel,
    message: string,
    metadata?: CommunicationMetadata,
  ): void => {
    const safeMeta = sanitizeLogMetadata(metadata);
    const entry: CommunicationLog = {
      id: createId(),
      at: new Date(),
      level,
      channel: options.channel,
      provider: options.provider,
      message,
      metadata: safeMeta,
    };
    store.push(entry);
    if (options.mirrorToConsole) {
      const fn =
        level === "error"
          ? console.error
          : level === "warn"
            ? console.warn
            : console.info;
      fn(`[communications:${level}]`, message, safeMeta ?? {});
    }
  };

  return {
    debug: (message, metadata) => write("debug", message, metadata),
    info: (message, metadata) => write("info", message, metadata),
    warn: (message, metadata) => write("warn", message, metadata),
    error: (message, metadata) => write("error", message, metadata),
    entries: () => store,
  };
}
