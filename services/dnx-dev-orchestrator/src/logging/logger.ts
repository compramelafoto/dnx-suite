export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  component: string;
  event: string;
  message: string;
  taskId?: string;
  stageId?: string;
  metadata?: Record<string, unknown>;
};

const SECRET_KEY_PATTERN =
  /(api[_-]?key|token|secret|password|authorization|cookie|credential|openai|cursor_api)/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (SECRET_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string" && /sk-[a-zA-Z0-9]{10,}/.test(value)) {
    return "[REDACTED]";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return sanitizeMetadata(value as Record<string, unknown>);
  }
  return value;
}

export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    out[key] = sanitizeValue(key, value);
  }
  return out;
}

export function createLogger(component: string) {
  return {
    log(event: Omit<LogEvent, "component"> & { component?: string }): void {
      const payload = {
        timestamp: new Date().toISOString(),
        level: event.level,
        component: event.component ?? component,
        event: event.event,
        message: event.message,
        ...(event.taskId ? { taskId: event.taskId } : {}),
        ...(event.stageId ? { stageId: event.stageId } : {}),
        ...(event.metadata ? { metadata: sanitizeMetadata(event.metadata) } : {}),
      };

      const line = JSON.stringify(payload);
      if (event.level === "error") {
        console.error(line);
      } else if (event.level === "warn") {
        console.warn(line);
      } else {
        console.log(line);
      }
    },
    info(event: string, message: string, extra?: Partial<LogEvent>): void {
      this.log({ level: "info", event, message, ...extra });
    },
    warn(event: string, message: string, extra?: Partial<LogEvent>): void {
      this.log({ level: "warn", event, message, ...extra });
    },
    error(event: string, message: string, extra?: Partial<LogEvent>): void {
      this.log({ level: "error", event, message, ...extra });
    },
    debug(event: string, message: string, extra?: Partial<LogEvent>): void {
      this.log({ level: "debug", event, message, ...extra });
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
