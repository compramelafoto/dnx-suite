/**
 * Sanitización determinista básica (sin IA).
 * Usá conversaciones ficticias o anonimizadas siempre que sea posible.
 */
export function redactPersonalData(text: string): string {
  let out = text;
  out = out.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]",
  );
  out = out.replace(
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g,
    (m) => (m.replace(/\D/g, "").length >= 8 ? "[REDACTED_PHONE]" : m),
  );
  out = out.replace(
    /\b(?:DNI|CUIT|CUIL)[\s:.-]*\d{7,11}\b/gi,
    "[REDACTED_DOCUMENT]",
  );
  out = out.replace(
    /\b(?:sk-|rk_|pk_|Bearer\s+)[A-Za-z0-9_-]{16,}\b/g,
    "[REDACTED_TOKEN]",
  );
  out = out.replace(
    /https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)[^\s]*/gi,
    "[REDACTED_PRIVATE_URL]",
  );
  return out;
}

export function redactCalibrationTextFields<T extends Record<string, unknown>>(
  obj: T,
  keys: string[],
): T {
  const clone = structuredClone(obj);
  for (const key of keys) {
    const value = clone[key];
    if (typeof value === "string") {
      (clone as Record<string, unknown>)[key] = redactPersonalData(value);
    }
  }
  return clone;
}
