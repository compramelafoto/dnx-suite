const SENSITIVE_KEYS = new Set(["password", "ftpPassword", "ftpPasswordHash", "pass"]);

export type GatewayLogFields = {
  username?: string;
  ftpUsername?: string;
  userId?: number;
  albumId?: number;
  filename?: string;
  size?: number;
  rawKey?: string;
  status?: string;
  [key: string]: unknown;
};

function sanitizeFields(fields: GatewayLogFields): GatewayLogFields {
  const out: GatewayLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function write(level: "info" | "warn" | "error", event: string, fields: GatewayLogFields) {
  const payload = sanitizeFields(fields);
  const line = `[camera-ftp-gateway] ${event}`;
  if (level === "info") console.info(line, payload);
  else if (level === "warn") console.warn(line, payload);
  else console.error(line, payload);
}

export function logInfo(event: string, fields: GatewayLogFields = {}) {
  write("info", event, fields);
}

export function logWarn(event: string, fields: GatewayLogFields = {}) {
  write("warn", event, fields);
}

export function logError(event: string, fields: GatewayLogFields = {}) {
  write("error", event, fields);
}
