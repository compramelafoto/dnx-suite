import { CommunicationError } from "../../shared/errors";
import { isBasicEmailFormat, normalizeEmailAddress } from "./allowlist";

export type ControlledFromAddress = {
  email: string;
  name: string;
};

/**
 * Valida remitente controlado (RESEND_FROM_EMAIL / RESEND_FROM_NAME).
 * Sin saltos de línea ni caracteres de header-injection.
 */
export function parseControlledFromAddress(input: {
  email: string | undefined;
  name: string | undefined;
}): ControlledFromAddress {
  const emailRaw = input.email?.trim() ?? "";
  const nameRaw = input.name?.trim() ?? "";

  if (!emailRaw || !nameRaw) {
    throw new CommunicationError(
      "INVALID_FROM_ADDRESS",
      "RESEND_FROM_EMAIL y RESEND_FROM_NAME son obligatorios.",
    );
  }

  if (/[\r\n]/.test(emailRaw) || /[\r\n]/.test(nameRaw)) {
    throw new CommunicationError(
      "INVALID_FROM_ADDRESS",
      "El remitente no puede contener saltos de línea.",
    );
  }

  if (/[<>]/.test(nameRaw)) {
    throw new CommunicationError(
      "INVALID_FROM_ADDRESS",
      "RESEND_FROM_NAME contiene caracteres no permitidos.",
    );
  }

  const email = normalizeEmailAddress(emailRaw);
  if (!isBasicEmailFormat(email)) {
    throw new CommunicationError(
      "INVALID_FROM_ADDRESS",
      "RESEND_FROM_EMAIL tiene formato inválido.",
    );
  }

  return { email, name: nameRaw };
}
