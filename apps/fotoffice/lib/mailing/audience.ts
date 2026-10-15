/**
 * A quién le llega un envío a socios. Módulo puro.
 *
 * Socios activos con correo, una sola vez por casilla (dos fichas con el mismo correo reciben un
 * correo), menos quienes se dieron de baja del tema o de todo.
 */

export type AudienceMember = { id: string; email: string | null; firstName: string | null };
export type OptOutRow = { email: string; topic: string };
export type Recipient = { memberId: string; email: string; firstName: string | null };

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>.]+(?:\.[^\s@,;<>.]+)+$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

export function buildAudience(
  members: AudienceMember[],
  optOuts: OptOutRow[],
  topic: string,
): { recipients: Recipient[]; optedOut: number } {
  const bajas = new Set(
    optOuts.filter((o) => o.topic === topic || o.topic === "all").map((o) => o.email.trim().toLowerCase()),
  );
  const vistos = new Set<string>();
  const recipients: Recipient[] = [];
  let optedOut = 0;
  for (const m of members) {
    const email = normalizeEmail(m.email);
    if (!email || vistos.has(email)) continue;
    vistos.add(email);
    if (bajas.has(email)) {
      optedOut += 1;
      continue;
    }
    recipients.push({ memberId: m.id, email, firstName: m.firstName?.trim() || null });
  }
  return { recipients, optedOut };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
