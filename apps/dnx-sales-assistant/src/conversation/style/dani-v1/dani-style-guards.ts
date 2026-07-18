const FORBIDDEN_RE =
  /\b(ingrese|indique|campo requerido|solicitud incompleta|para continuar con el proceso|he procesado su solicitud|\bdto\b|\bdraft\b|\bpipeline\b|motor de precios|\bvalidaci[oó]n\b|READY_FOR_CALCULATION|\bpricing\b|quoteRequest|breakdown)\b/i;

/** Violaciones críticas que disparan fallback en runtime. */
export function hasCriticalStyleViolation(message: string): boolean {
  return FORBIDDEN_RE.test(message);
}

export function styleGuardWarning(message: string): string | undefined {
  if (hasCriticalStyleViolation(message)) {
    return "CRITICAL_STYLE_VIOLATION";
  }
  return undefined;
}
