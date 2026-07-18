type LogFields = Record<string, unknown>;

const SERVICE = "dnx-sales-assistant";

function write(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = `[${SERVICE}] ${event}`;
  if (level === "info") console.info(line, fields);
  else if (level === "warn") console.warn(line, fields);
  else console.error(line, fields);
}

export function logInfo(event: string, fields: LogFields = {}): void {
  write("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}): void {
  write("warn", event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  write("error", event, fields);
}
