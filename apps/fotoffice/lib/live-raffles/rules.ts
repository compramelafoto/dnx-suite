/**
 * Sorteo en vivo: las reglas puras, sin base ni servidor, para poder probarlas y para que las
 * pantallas cliente las importen sin arrastrar `server-only`.
 */

export type DedupMode = "CELULAR" | "CELULAR_DNI";

export const DEDUP_LABELS: Record<DedupMode, string> = {
  CELULAR: "Celular único",
  CELULAR_DNI: "Celular y DNI únicos",
};

export function parseDedupMode(value: unknown): DedupMode {
  return value === "CELULAR_DNI" ? "CELULAR_DNI" : "CELULAR";
}

/** Sólo dígitos: "+54 9 341 555-1234" y "3415551234" se comparan por sus últimos 10. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // En Argentina el mismo número se escribe con o sin 54, 9 y 0/15: los últimos 10 dígitos son la persona.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeDni(raw: string): string {
  return raw.replace(/\D/g, "");
}

export type EntrantInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dni: string | null;
};

export function parseEntrantForm(
  form: FormData,
  mode: DedupMode,
  requiresRules: boolean,
): { ok: true; values: EntrantInput } | { ok: false; error: string } {
  const texto = (k: string) => String(form.get(k) ?? "").trim();
  const firstName = texto("firstName").slice(0, 80);
  const lastName = texto("lastName").slice(0, 80);
  const phone = normalizePhone(texto("phone"));
  const emailRaw = texto("email").slice(0, 160);
  const dniRaw = normalizeDni(texto("dni"));

  if (!firstName || !lastName) return { ok: false, error: "Completá nombre y apellido." };
  if (phone.length < 8) return { ok: false, error: "Revisá el celular: tiene que tener al menos 8 números." };
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { ok: false, error: "Revisá el correo." };
  }
  if (mode === "CELULAR_DNI" && (dniRaw.length < 6 || dniRaw.length > 9)) {
    return { ok: false, error: "Revisá el DNI: va sin puntos, entre 6 y 9 números." };
  }
  if (requiresRules && form.get("acceptRules") !== "on") {
    return { ok: false, error: "Para participar tenés que aceptar las bases y condiciones." };
  }
  return {
    ok: true,
    values: {
      firstName,
      lastName,
      phone,
      email: emailRaw || null,
      dni: mode === "CELULAR_DNI" ? dniRaw : null,
    },
  };
}

/**
 * Quiénes pueden salir para un premio: todos los inscriptos menos los que ya ganaron otro
 * premio (si la regla está activa) y los que salieron para este premio y no estaban.
 */
export function eligibleEntrantIds(params: {
  entrantIds: readonly string[];
  prizeId: string;
  prizes: readonly { id: string; winnerEntrantId: string | null; absentEntrantIds: readonly string[] }[];
  oneWinPerPerson: boolean;
}): string[] {
  const prize = params.prizes.find((p) => p.id === params.prizeId);
  const excluidos = new Set<string>(prize?.absentEntrantIds ?? []);
  if (params.oneWinPerPerson) {
    for (const p of params.prizes) {
      if (p.id !== params.prizeId && p.winnerEntrantId) excluidos.add(p.winnerEntrantId);
    }
  }
  return params.entrantIds.filter((id) => !excluidos.has(id));
}

/** Las opciones de una encuesta, una por renglón, sin vacías ni repetidas. */
export function parsePollOptions(raw: string): string[] {
  const vistas = new Set<string>();
  const opciones: string[] = [];
  for (const linea of raw.split(/\r?\n/)) {
    const o = linea.trim().slice(0, 120);
    if (!o || vistas.has(o.toLowerCase())) continue;
    vistas.add(o.toLowerCase());
    opciones.push(o);
  }
  return opciones.slice(0, 12);
}

export function voteTotals(optionCount: number, votes: readonly { optionIndex: number }[]): number[] {
  const totales = Array.from({ length: optionCount }, () => 0);
  for (const v of votes) if (v.optionIndex >= 0 && v.optionIndex < optionCount) totales[v.optionIndex]++;
  return totales;
}
