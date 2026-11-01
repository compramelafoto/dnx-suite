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

export type DrawRow = { round: number; entrantId: string; prizeId: string | null; status: string };

/** Lo que sale de leer y validar los números de la configuración. */
export function parseNonNegativeInt(value: unknown, max: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
}

/**
 * Quiénes pueden salir en el sorteo número `round`:
 *
 * - `maxWins`: cuántas veces puede ganar una persona (0 = sin límite).
 * - `cooldown`: cuántos sorteos con ganador tienen que pasar, desde que alguien ganó, para que
 *   pueda volver a salir. Con 3, quien ganó en el sorteo 2 no puede salir en el 3, 4 ni 5.
 * - Los que salieron en este mismo sorteo y no estaban (AUSENTE) tampoco vuelven a salir.
 *
 * Los resultados del propio `round` no cuentan: al volver a sortear, ese sorteo se está rehaciendo.
 */
export function eligibleEntrantIds(params: {
  entrantIds: readonly string[];
  draws: readonly DrawRow[];
  round: number;
  maxWins: number;
  cooldown: number;
}): string[] {
  const ganados = params.draws.filter((d) => d.status === "GANADOR" && d.round !== params.round);
  const rondasConGanador = [...new Set(ganados.map((d) => d.round))];
  const victorias = new Map<string, number>();
  const ultima = new Map<string, number>();
  for (const d of ganados) {
    victorias.set(d.entrantId, (victorias.get(d.entrantId) ?? 0) + 1);
    ultima.set(d.entrantId, Math.max(ultima.get(d.entrantId) ?? 0, d.round));
  }
  const ausentes = new Set(
    params.draws.filter((d) => d.status === "AUSENTE" && d.round === params.round).map((d) => d.entrantId),
  );

  return params.entrantIds.filter((id) => {
    if (ausentes.has(id)) return false;
    if (params.maxWins > 0 && (victorias.get(id) ?? 0) >= params.maxWins) return false;
    const r = ultima.get(id);
    if (params.cooldown > 0 && r !== undefined) {
      const pasaron = rondasConGanador.filter((x) => x > r).length;
      if (pasaron < params.cooldown) return false;
    }
    return true;
  });
}

/** El ganador vigente de cada sorteo (el último GANADOR de cada número), en orden. */
export function currentWinners<T extends DrawRow>(draws: readonly T[]): T[] {
  const porRonda = new Map<number, T>();
  for (const d of draws) if (d.status === "GANADOR") porRonda.set(d.round, d);
  return [...porRonda.values()].sort((a, b) => a.round - b.round);
}

export type PollKind = "OPCIONES" | "TEXTO";

export function parsePollKind(value: unknown): PollKind {
  return value === "TEXTO" ? "TEXTO" : "OPCIONES";
}

/** El voto que llega del formulario: una opción, "Otra" con texto, o un párrafo. */
export function parseVote(
  form: FormData,
  poll: { kind: string; options: readonly string[]; allowOther: boolean },
): { ok: true; optionIndex: number | null; text: string | null } | { ok: false; error: string } {
  const texto = String(form.get("text") ?? "").trim().slice(0, 2000);
  if (parsePollKind(poll.kind) === "TEXTO") {
    return texto ? { ok: true, optionIndex: null, text: texto } : { ok: false, error: "Escribí tu respuesta." };
  }
  const elegido = String(form.get("optionIndex") ?? "");
  if (elegido === "otra") {
    if (!poll.allowOther) return { ok: false, error: "Elegí una opción." };
    return texto ? { ok: true, optionIndex: null, text: texto.slice(0, 200) } : { ok: false, error: "Escribí tu otra opción." };
  }
  const n = Number(elegido);
  if (elegido === "" || !Number.isInteger(n) || n < 0 || n >= poll.options.length) {
    return { ok: false, error: "Elegí una opción." };
  }
  return { ok: true, optionIndex: n, text: null };
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

export function voteTotals(optionCount: number, votes: readonly { optionIndex: number | null }[]): number[] {
  const totales = Array.from({ length: optionCount }, () => 0);
  for (const v of votes) {
    if (v.optionIndex !== null && v.optionIndex >= 0 && v.optionIndex < optionCount) totales[v.optionIndex]++;
  }
  return totales;
}

/** Las respuestas escritas: los párrafos, o lo que se puso en "Otra". La más nueva primero. */
export function writtenAnswers(votes: readonly { optionIndex: number | null; text: string | null; createdAt?: Date }[]): string[] {
  return [...votes]
    .filter((v) => v.optionIndex === null && v.text)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map((v) => v.text as string);
}
