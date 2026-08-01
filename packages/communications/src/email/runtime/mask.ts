/**
 * Enmascara un email para logs: da***@example.com
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return "***";
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain.toLowerCase()}`;
}

/** Dominio del destinatario (sin local-part). */
export function emailDomain(email: string): string | undefined {
  const at = email.trim().indexOf("@");
  if (at <= 0) return undefined;
  return email.trim().slice(at + 1).toLowerCase();
}
