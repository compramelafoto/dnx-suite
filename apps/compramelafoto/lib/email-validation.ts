/**
 * Validación de email para checkouts (solo cliente).
 * No reemplaza validaciones server-side existentes.
 */

const DOMAIN_TYPO_MAP: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.con": "gmail.com",
  "hotnail.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "yaho.com": "yahoo.com",
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isLikelyValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;

  const normalized = trimmed.toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return false;

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (!local || !domain || !domain.includes(".")) return false;

  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return false;

  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2) return false;

  return true;
}

export function getEmailSuggestion(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return null;

  const normalized = trimmed.toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return null;

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (!local || !domain) return null;

  const correctedDomain = DOMAIN_TYPO_MAP[domain];
  if (!correctedDomain || correctedDomain === domain) return null;

  return `${local}@${correctedDomain}`;
}

/** Mensaje breve para bloquear submit en formularios de checkout. */
export function getCheckoutEmailValidationError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Ingresá un email para continuar.";
  if (/\s/.test(trimmed)) return "El email no puede contener espacios.";
  if (!isLikelyValidEmail(trimmed)) return "Revisá el email antes de continuar.";
  return null;
}
