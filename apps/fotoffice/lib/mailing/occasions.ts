import type { RenderedEmailSignature } from "@repo/communications/signature";
import { C, FUENTE, escapeHtml } from "@/lib/communications/html";
import { button, safeAccent, safeHttpsUrl, textFooter, wrapMailing, type MailingBrand, type MailingFooter } from "./layout";
import type { OccasionConfig } from "./occasions-catalog";

/**
 * Fechas de saludo: qué toca hoy, a quién y con qué texto. Módulo puro.
 *
 * Las fechas de nacimiento y de ingreso son fechas sin hora guardadas a medianoche UTC: se leen en
 * UTC. «Hoy» es el día en Argentina (UTC−3 fijo, sin horario de verano).
 */

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const OCCASION_HOUR_AR = 9;

export type Ymd = { y: number; m: number; d: number };

export function argentinaToday(now: Date): Ymd {
  const ar = new Date(now.getTime() - AR_OFFSET_MS);
  return { y: ar.getUTCFullYear(), m: ar.getUTCMonth() + 1, d: ar.getUTCDate() };
}

export function ymdKey(t: Ymd): string {
  return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
}

/** Desde las 9 de la mañana de Argentina. */
export function isOccasionWindow(now: Date): boolean {
  return new Date(now.getTime() - AR_OFFSET_MS).getUTCHours() >= OCCASION_HOUR_AR;
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** El día del año coincide. Un 29/2 se saluda el 28/2 los años que no son bisiestos. */
export function sameDayOfYear(month: number, day: number, today: Ymd): boolean {
  if (month === today.m && day === today.d) return true;
  return month === 2 && day === 29 && !esBisiesto(today.y) && today.m === 2 && today.d === 28;
}

/** Fecha válida de calendario (29/2 se admite: cae en años bisiestos). */
export function isValidMonthDay(month: number | null, day: number | null): boolean {
  if (!month || !day || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= max;
}

/** Años cumplidos desde una fecha sin hora (medianoche UTC) hasta `today`. */
export function yearsSince(date: Date, today: Ymd): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  let anios = today.y - y;
  if (today.m < m || (today.m === m && today.d < d)) anios -= 1;
  return anios;
}

export function isMilestone(years: number): boolean {
  return years === 1 || (years > 0 && years % 5 === 0);
}

export function yearsLabel(years: number): string {
  return years === 1 ? "1 año" : `${years} años`;
}

/** Fechas del año encendidas que caen hoy (con fecha cargada). */
export function efemeridesForToday(occasions: OccasionConfig[], today: Ymd): OccasionConfig[] {
  return occasions.filter(
    (o) =>
      o.kind === "EFEMERIDE" &&
      o.enabled &&
      isValidMonthDay(o.month, o.day) &&
      sameDayOfYear(o.month as number, o.day as number, today),
  );
}

export type DatedMember = { id: string; email: string | null; firstName: string | null; date: Date };

export function birthdaysToday<T extends DatedMember>(members: T[], today: Ymd): T[] {
  return members.filter((m) => sameDayOfYear(m.date.getUTCMonth() + 1, m.date.getUTCDate(), today));
}

/** Aniversarios de ingreso de hoy, con 1 año o más (y sólo los redondos si así se configuró). */
export function anniversariesToday<T extends DatedMember>(members: T[], today: Ymd, milestonesOnly: boolean): T[] {
  return members.filter((m) => {
    if (!sameDayOfYear(m.date.getUTCMonth() + 1, m.date.getUTCDate(), today)) return false;
    const anios = yearsSince(m.date, today);
    return anios >= 1 && (!milestonesOnly || isMilestone(anios));
  });
}

/** Próxima vez que cae una fecha del año, desde hoy (incluido). */
export function nextOccurrence(month: number, day: number, today: Ymd): Ymd {
  const esteAnio = { y: today.y, m: month, d: day };
  const pasada = month < today.m || (month === today.m && day < today.d);
  const y = pasada ? today.y + 1 : today.y;
  if (month === 2 && day === 29 && !esBisiesto(y)) return { y, m: 2, d: 28 };
  return pasada ? { y, m: month, d: day } : esteAnio;
}

export function daysUntil(target: Ymd, today: Ymd): number {
  return Math.round((Date.UTC(target.y, target.m - 1, target.d) - Date.UTC(today.y, today.m - 1, today.d)) / 86400000);
}

// ─── Texto ─────────────────────────────────────────────────────────────────────────────────

export type TemplateVars = { nombre: string | null; institucion: string; anios?: number | null };

/**
 * Reemplaza las variables. Sin nombre, «¡Feliz cumpleaños, {nombre}!» queda «¡Feliz cumpleaños!»:
 * se va la coma que lo precede, no queda un hueco.
 */
export function renderTemplate(text: string, vars: TemplateVars): string {
  let out = text;
  if (vars.nombre?.trim()) out = out.replace(/\{nombre\}/g, vars.nombre.trim());
  else out = out.replace(/,?[ \t]*\{nombre\}/g, "");
  out = out.replace(/\{institucion\}/g, vars.institucion);
  out = out.replace(/\{años\}|\{anios\}/g, vars.anios != null ? yearsLabel(vars.anios) : "");
  return out;
}

export function paragraphsHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export type OccasionEmailBody = { subject: string; html: string; text: string };

export function buildOccasionEmail(input: {
  brand: MailingBrand;
  occasion: Pick<OccasionConfig, "title" | "subject" | "message" | "imageUrl">;
  vars: TemplateVars;
  signature: RenderedEmailSignature | null;
  footer: MailingFooter;
  /** Botón (ciclo del socio): al portal o al sitio. Sin dirección https no se dibuja. */
  cta?: { label: string; url: string | null } | null;
}): OccasionEmailBody {
  const subject = renderTemplate(input.occasion.subject, input.vars).replace(/\s+/g, " ").trim().slice(0, 150);
  const cuerpo = renderTemplate(input.occasion.message, input.vars);
  const imagen = safeHttpsUrl(input.occasion.imageUrl);
  const ctaUrl = safeHttpsUrl(input.cta?.url ?? null);

  const contentHtml = [
    imagen
      ? `<img src="${escapeHtml(imagen)}" alt="${escapeHtml(input.occasion.title)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;margin:0 0 20px;">`
      : "",
    `<div style="font-family:${FUENTE};font-size:16px;line-height:1.6;color:${C.cuerpo};">${paragraphsHtml(cuerpo)}</div>`,
    ctaUrl && input.cta ? button(input.cta.label, ctaUrl, safeAccent(input.brand.accentColor)) : "",
  ].join("\n");

  const html = wrapMailing({
    brand: input.brand,
    preheader: cuerpo.replace(/\s+/g, " ").slice(0, 140),
    contentHtml,
    signature: input.signature,
    footer: input.footer,
  });
  const text = [
    cuerpo.trim(),
    ...(ctaUrl && input.cta ? ["", `${input.cta.label}: ${ctaUrl}`] : []),
    ...(input.signature ? ["", input.signature.text] : []),
    "",
    textFooter(input.footer),
  ].join("\n");
  return { subject, html, text };
}

// ─── Ciclo del socio ───────────────────────────────────────────────────────────────────────

/**
 * La fecha de un hecho en días argentinos. Las fechas cargadas a mano (ingreso importado, baja)
 * son fechas sin hora a medianoche UTC: se leen en UTC. Las que guardó la aplicación al momento
 * (un alta aprobada a las 22 h) tienen hora: se pasan a la fecha argentina.
 */
export function eventDay(date: Date): Ymd {
  const esFechaSola =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  return esFechaSola
    ? { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
    : argentinaToday(date);
}

/** `today` menos `days` días. */
export function daysBefore(today: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(today.y, today.m - 1, today.d - days));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function mismoDia(a: Ymd, b: Ymd): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

export type LifecycleMember = {
  id: string;
  email: string | null;
  firstName: string | null;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  joinedAt: Date;
  leftAt: Date | null;
  leftReason: string | null;
  lastLoginAt: Date | null;
};

/** Socios activos que entraron hace exactamente `days` días. */
export function joinedDaysAgo<T extends LifecycleMember>(members: T[], today: Ymd, days: number): T[] {
  const objetivo = daysBefore(today, days);
  return members.filter((m) => m.status === "ACTIVE" && mismoDia(eventDay(m.joinedAt), objetivo));
}

/** Ex socios dados de baja hace exactamente `days` días. Nunca los dados de baja por sanción. */
export function leftDaysAgo<T extends LifecycleMember>(members: T[], today: Ymd, days: number): T[] {
  const objetivo = daysBefore(today, days);
  return members.filter(
    (m) => m.status === "INACTIVE" && m.leftAt !== null && m.leftReason !== "SANCION" && mismoDia(eventDay(m.leftAt), objetivo),
  );
}

/**
 * Socios activos con cuenta que no entran al portal hace `days` días o más, menos los que ya
 * recibieron este aviso en los últimos `cooldownDays` (casillas en minúsculas).
 * Quien nunca activó la cuenta no entra: para eso está la invitación.
 */
export function inactiveForDays<T extends LifecycleMember>(
  members: T[],
  now: Date,
  days: number,
  recentlyNotified: Set<string>,
): T[] {
  const limite = now.getTime() - days * 86400000;
  return members.filter(
    (m) =>
      m.status === "ACTIVE" &&
      m.lastLoginAt !== null &&
      m.lastLoginAt.getTime() <= limite &&
      !recentlyNotified.has((m.email ?? "").trim().toLowerCase()),
  );
}

export const NO_LOGIN_COOLDOWN_DAYS = 90;
export const LIFECYCLE_DAYS_RANGE = { min: 1, max: 730 } as const;
