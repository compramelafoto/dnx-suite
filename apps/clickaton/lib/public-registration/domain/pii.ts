/** Enmascarado PII para DTOs públicos de resumen. */

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!user || !domain) return "••••";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}•••@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

export function maskDocument(documentNumber: string | null | undefined): string {
  if (!documentNumber) return "—";
  const digits = documentNumber.replace(/\s+/g, "");
  if (digits.length <= 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

export function displayPublicFirstName(firstName: string): string {
  return firstName.trim() || "—";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDocument(documentNumber: string | null | undefined): string | null {
  if (!documentNumber) return null;
  const n = documentNumber.replace(/[\s.\-/]/g, "").toUpperCase();
  return n.length ? n : null;
}
