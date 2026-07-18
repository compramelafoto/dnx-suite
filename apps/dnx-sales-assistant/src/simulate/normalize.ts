/**
 * Normaliza el teléfono de entrada a dígitos (E.164 sin '+').
 * Acepta espacios, guiones y '+' previos a la validación de longitud.
 */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function normalizeSimulateMessageInput(input: {
  from: string;
  message: string;
}): { from: string; message: string } {
  return {
    from: normalizePhoneDigits(input.from),
    message: input.message.trim(),
  };
}
