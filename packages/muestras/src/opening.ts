import { normalizeEmail } from "./curation";
import { arMinutesOfDay, dayStartAr, formatArClock, formatArWeekdayLong, toArDay } from "./dates";
import { hasLinkOrEmail } from "./guestbook";

/**
 * Inauguración y confirmación de asistencia (etapa 5, D12–D21). `openingAt` guarda día y hora en
 * UTC; una inauguración a las 00:00 argentinas es "sin hora" (filas de antes de esta etapa).
 */
export const RSVP_MODES = ["OFF", "OPEN", "CLOSED"] as const;
export type RsvpMode = (typeof RSVP_MODES)[number];
export const isRsvpMode = (v: unknown): v is RsvpMode => (RSVP_MODES as readonly unknown[]).includes(v);
export const RSVP_MODE_LABELS: Record<RsvpMode, string> = {
  OFF: "Entrada libre, sin confirmación",
  OPEN: "Recibe confirmaciones",
  CLOSED: "Confirmaciones cerradas",
};
export const RSVP_ENTRY_STATUSES = ["CONFIRMED", "WAITLIST", "CANCELLED"] as const;
export type RsvpEntryStatus = (typeof RSVP_ENTRY_STATUSES)[number];
export const RSVP_ENTRY_STATUS_LABELS: Record<RsvpEntryStatus, string> = {
  CONFIRMED: "Confirmada", WAITLIST: "En lista de espera", CANCELLED: "Cancelada",
};
export const RSVP_LIMITS = { name: 80, note: 300, maxCompanions: 9, capacity: 5000, entries: 2000 } as const;
/** Antes de limpiar nada: un campo más largo que esto ni se procesa. */
export const RSVP_RAW_MAX = 1000;
export const RSVP_RETENTION_DAYS = 30;
export const OPENING_DEFAULT_MINUTES = 120;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** "19:30" → 1170. Cualquier otra cosa → null. */
export function parseClock(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/** Día + hora argentina. Sin hora válida (o 00:00), el comienzo del día. Día inválido → null. */
export function openingAtFrom(day: string, clock: string | null): Date | null {
  let base: Date;
  try { base = dayStartAr(day); } catch { return null; }
  const m = parseClock(clock);
  return m ? new Date(base.getTime() + m * MIN) : base;
}

export function openingHasTime(d: Date | null | undefined): d is Date {
  return !!d && arMinutesOfDay(d) !== 0;
}

export function openingEnd(openingAt: Date, openingEndsAt: Date | null | undefined): Date {
  return openingEndsAt && openingEndsAt.getTime() > openingAt.getTime()
    ? openingEndsAt
    : new Date(openingAt.getTime() + OPENING_DEFAULT_MINUTES * MIN);
}

/** "19 h", "19:30 h". */
export function formatArTime(d: Date): string {
  const m = arMinutesOfDay(d);
  return m % 60 === 0 ? `${Math.floor(m / 60)} h` : `${formatArClock(d).replace(/^0/, "")} h`;
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function openingWhenText(openingAt: Date, openingEndsAt: Date | null | undefined): string {
  const dia = mayuscula(formatArWeekdayLong(openingAt));
  if (!openingHasTime(openingAt)) return dia;
  const fin = openingEndsAt && openingEndsAt.getTime() > openingAt.getTime() && toArDay(openingEndsAt) === toArDay(openingAt) ? openingEndsAt : null;
  if (!fin) return `${dia}, ${formatArTime(openingAt)}`;
  return `${dia}, de ${formatArTime(openingAt).replace(/ h$/, "")} a ${formatArTime(fin)}`;
}

/** Para el formulario de la ficha: día y horas como vienen del navegador. */
export function openingProblems(f: { openingDay: string | null; openingClock: string | null; openingEndClock: string | null; endDay: string }): string[] {
  const dia = (f.openingDay ?? "").trim(), hora = (f.openingClock ?? "").trim(), fin = (f.openingEndClock ?? "").trim();
  if (!dia) return hora || fin ? ["Para poner la hora, elegí también el día de la inauguración."] : [];
  if (hora && parseClock(hora) === null) return ["La hora de la inauguración no es válida (usá 19:30, por ejemplo)."];
  if (hora && parseClock(hora) === 0) return ["La inauguración no puede ser a las 00:00. Si no sabés la hora, dejala vacía."];
  if (fin && (parseClock(fin) === null || !hora || parseClock(fin)! <= parseClock(hora)!)) return ["La hora de fin tiene que ser después de la de inicio."];
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.endDay) && dia > f.endDay) return ["La inauguración no puede ser después del cierre de la muestra."];
  return [];
}

export type RsvpState = "UNAVAILABLE" | "OFF" | "OPEN" | "CLOSED";

export function rsvpState(
  a: { type: string; reviewStatus: string; isVirtualOnly: boolean; isCancelled: boolean; openingAt: Date | null; rsvpStatus: string },
  now: Date,
): RsvpState {
  if (a.type !== "MUESTRA" || a.reviewStatus !== "APPROVED" || a.isVirtualOnly || !openingHasTime(a.openingAt)) return "UNAVAILABLE";
  if (a.rsvpStatus === "OFF") return "OFF";
  if (a.isCancelled || a.rsvpStatus !== "OPEN" || now.getTime() >= a.openingAt.getTime()) return "CLOSED";
  return "OPEN";
}

export type RsvpInput = { name: string; email: string | null; companions: number; emailInvalid: boolean };

const limpiar = (v: unknown, max: number) =>
  // eslint-disable-next-line no-control-regex
  typeof v === "string" ? v.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function rsvpInput(raw: { name?: unknown; email?: unknown; companions?: unknown }): RsvpInput {
  const email = limpiar(raw.email, 254);
  const normal = email ? normalizeEmail(email) : null;
  const c = limpiar(raw.companions, 3);
  return {
    name: limpiar(raw.name, RSVP_LIMITS.name),
    email: normal,
    companions: c === "" ? 0 : /^\d+$/.test(c) ? Number(c) : Number.NaN,
    emailInvalid: !!email && !normal,
  };
}

export function rsvpProblems(i: RsvpInput, maxCompanions: number): string[] {
  const out: string[] = [];
  if (i.name.length < 2) out.push("Escribí tu nombre.");
  else if (hasLinkOrEmail(i.name)) out.push("El nombre no puede tener enlaces ni direcciones de correo.");
  if (i.emailInvalid) out.push("El email no es válido. Si no querés dejarlo, dejá el campo vacío.");
  if (!Number.isInteger(i.companions) || i.companions < 0 || i.companions > maxCompanions) {
    out.push(maxCompanions === 0 ? "Esta invitación es personal: no admite acompañantes." : `Podés sumar hasta ${maxCompanions} acompañantes.`);
  }
  return out;
}

export const partySize = (companions: number) => 1 + companions;

export function rsvpPlacement(p: { capacity: number | null; confirmedPeople: number; party: number }): "CONFIRMED" | "WAITLIST" {
  return p.capacity == null || p.confirmedPeople + p.party <= p.capacity ? "CONFIRMED" : "WAITLIST";
}

/** `waitlist` en orden de llegada. Pasa quien entra; quien no entra espera y sigue el siguiente (D16). */
export function promoteFromWaitlist(p: { capacity: number | null; confirmedPeople: number; waitlist: readonly { id: string; companions: number }[] }): string[] {
  let ocupado = p.confirmedPeople;
  const out: string[] = [];
  for (const w of p.waitlist) {
    const n = partySize(w.companions);
    if (p.capacity == null || ocupado + n <= p.capacity) { out.push(w.id); ocupado += n; }
  }
  return out;
}

export type RsvpTotals = { confirmed: number; people: number; waitlist: number; waitlistPeople: number; cancelled: number };
export function rsvpTotals(rows: readonly { status: string; companions: number }[]): RsvpTotals {
  const t: RsvpTotals = { confirmed: 0, people: 0, waitlist: 0, waitlistPeople: 0, cancelled: 0 };
  for (const r of rows) {
    if (r.status === "CONFIRMED") { t.confirmed++; t.people += partySize(r.companions); }
    else if (r.status === "WAITLIST") { t.waitlist++; t.waitlistPeople += partySize(r.companions); }
    else if (r.status === "CANCELLED") t.cancelled++;
  }
  return t;
}

export function rsvpPurgeDue(endsAt: Date, now: Date): boolean {
  return now.getTime() > endsAt.getTime() + RSVP_RETENTION_DAYS * DAY;
}

export type OpeningEvent = { id: string; title: string; openingAt: Date; openingEndsAt: Date | null; venue: string; note: string | null; url: string; stamp: Date };

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega a 75 octetos sin cortar un carácter UTF-8 por la mitad (RFC 5545, 3.1). */
function plegar(linea: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let actual = "", bytes = 0, limite = 75;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    if (bytes + n > limite) { partes.push(actual); actual = ""; bytes = 0; limite = 74; }
    actual += ch; bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

export function openingIcs(e: OpeningEvent): string {
  const fin = openingEnd(e.openingAt, e.openingEndsAt);
  const descripcion = [e.note, e.url].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muestras Fotograficas//Inauguracion//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:inauguracion-${e.id}@muestrasfotograficas.com`,
    `DTSTAMP:${utc(e.stamp)}`, `DTSTART:${utc(e.openingAt)}`, `DTEND:${utc(fin)}`,
    `SUMMARY:${esc(`Inauguración: ${e.title}`)}`, `LOCATION:${esc(e.venue)}`, `DESCRIPTION:${esc(descripcion)}`, `URL:${e.url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].map(plegar).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: OpeningEvent): string {
  const fin = openingEnd(e.openingAt, e.openingEndsAt);
  const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
  // `dates` va sin codificar: Google espera la barra tal cual.
  return `https://calendar.google.com/calendar/render?${[
    q("action", "TEMPLATE"), q("text", `Inauguración: ${e.title}`), `dates=${utc(e.openingAt)}/${utc(fin)}`,
    q("details", [e.note, e.url].filter(Boolean).join("\n\n")), q("location", e.venue),
  ].join("&")}`;
}

export type RsvpCsvRow = { name: string; email: string | null; companions: number; status: string; createdAt: Date };

function celda(v: string): string {
  // Un texto que empieza con = + - @ lo ejecuta Excel como fórmula (inyección CSV).
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV para Excel en castellano: BOM, separador `;`, CRLF, fecha en hora argentina. */
export function rsvpCsv(rows: readonly RsvpCsvRow[]): string {
  const fecha = (d: Date) => { const [y, m, dd] = toArDay(d).split("-"); return `${dd}/${m}/${y} ${formatArClock(d)}`; };
  const lineas = [
    ["Nombre", "Email", "Acompañantes", "Personas", "Estado", "Confirmó el"],
    ...rows.map((r) => [r.name, r.email ?? "", String(r.companions), String(partySize(r.companions)),
      RSVP_ENTRY_STATUS_LABELS[r.status as RsvpEntryStatus] ?? r.status, fecha(r.createdAt)]),
  ];
  return "\uFEFF" + lineas.map((l) => l.map(celda).join(";")).join("\r\n") + "\r\n";
}
