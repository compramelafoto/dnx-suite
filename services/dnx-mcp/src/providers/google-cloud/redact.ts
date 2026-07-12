const SENSITIVE_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /ya29\.[A-Za-z0-9._~-]+/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /"private_key"\s*:\s*"[^"]+"/gi,
  /"client_secret"\s*:\s*"[^"]+"/gi,
  /"access_token"\s*:\s*"[^"]+"/gi,
  /"refresh_token"\s*:\s*"[^"]+"/gi,
  /password[=:]\s*\S+/gi,
];

/** Redacta valores sensibles de texto (stdout/stderr/errores/auditoría). */
export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

/** Elimina un valor exacto (p. ej. payload de secreto) de cualquier texto. */
export function scrubExactValue(text: string, value: string | undefined): string {
  if (!value || value.length === 0) return text;
  return text.split(value).join("[REDACTED]");
}
