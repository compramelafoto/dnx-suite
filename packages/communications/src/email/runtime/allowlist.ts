import { CommunicationError } from "../../shared/errors";

const BASIC_EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmailAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isBasicEmailFormat(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (email.includes("*") || email.includes(" ") || email.startsWith("@")) {
    return false;
  }
  return BASIC_EMAIL.test(email);
}

/**
 * Parsea RESEND_ALLOWED_RECIPIENTS (coma-separado).
 * Sin wildcards, sin dominios sueltos, sin regex.
 */
export function parseAllowedRecipients(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") {
    throw new CommunicationError(
      "INVALID_ALLOWED_RECIPIENTS",
      "RESEND_ALLOWED_RECIPIENTS está vacío o ausente.",
    );
  }

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new CommunicationError(
      "INVALID_ALLOWED_RECIPIENTS",
      "RESEND_ALLOWED_RECIPIENTS no contiene direcciones válidas.",
    );
  }

  const normalized: string[] = [];
  for (const part of parts) {
    if (part.includes("*") || part.startsWith("@") || !part.includes("@")) {
      throw new CommunicationError(
        "INVALID_ALLOWED_RECIPIENTS",
        "Allowlist no admite wildcards ni dominios completos.",
      );
    }
    const email = normalizeEmailAddress(part);
    if (!isBasicEmailFormat(email)) {
      throw new CommunicationError(
        "INVALID_ALLOWED_RECIPIENTS",
        "Allowlist contiene una dirección con formato inválido.",
      );
    }
    if (!normalized.includes(email)) {
      normalized.push(email);
    }
  }
  return normalized;
}

export type RecipientAllowlistCheck = {
  ok: true;
} | {
  ok: false;
  errorCode: "RECIPIENT_NOT_ALLOWED";
  errorMessage: string;
  blockedCount: number;
};

export function assertRecipientsAllowed(
  allowlist: readonly string[],
  recipients: {
    to: string[];
    cc?: string[];
    bcc?: string[];
  },
): RecipientAllowlistCheck {
  const allowed = new Set(allowlist.map(normalizeEmailAddress));
  const all = [
    ...recipients.to,
    ...(recipients.cc ?? []),
    ...(recipients.bcc ?? []),
  ].map(normalizeEmailAddress);

  const blocked = all.filter((email) => !allowed.has(email));
  if (blocked.length > 0) {
    return {
      ok: false,
      errorCode: "RECIPIENT_NOT_ALLOWED",
      errorMessage:
        "Uno o más destinatarios (to/cc/bcc) no están en RESEND_ALLOWED_RECIPIENTS. Envío bloqueado por completo.",
      blockedCount: blocked.length,
    };
  }
  return { ok: true };
}

export function isRecipientAllowed(
  allowlist: readonly string[],
  email: string,
): boolean {
  return allowlist.map(normalizeEmailAddress).includes(normalizeEmailAddress(email));
}
