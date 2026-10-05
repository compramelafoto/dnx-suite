import { ESPECIALIDADES } from "@/lib/membership/specialties";
import { isValidMonthDay } from "./occasions";
import type { OccasionConfig, OccasionRow } from "./occasions-catalog";
import { safeHttpsUrl } from "./layout";

/**
 * Validación del formulario de una fecha (Comunicación → Fechas). Módulo puro.
 */

export const OCCASION_LIMITS = { title: 120, subject: 150, message: 5000 } as const;

const IDS = new Set<string>(ESPECIALIDADES.map((e) => e.id));

export type OccasionFormResult = { ok: true; row: OccasionRow } | { ok: false; error: string };

function texto(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
}

function entero(v: FormDataEntryValue | null): number | null {
  const t = texto(v);
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : NaN;
}

export function parseOccasionForm(base: OccasionConfig, form: FormData): OccasionFormResult {
  const enabled = form.get("enabled") === "on" || form.get("enabled") === "1";
  const title = texto(form.get("title")) || base.title;
  const subject = texto(form.get("subject"));
  const message = texto(form.get("message"));
  const imagenCruda = texto(form.get("imageUrl"));

  if (title.length > OCCASION_LIMITS.title) return { ok: false, error: `El nombre admite hasta ${OCCASION_LIMITS.title} caracteres.` };
  if (!subject) return { ok: false, error: "Escribí el asunto del correo." };
  if (subject.length > OCCASION_LIMITS.subject) return { ok: false, error: `El asunto admite hasta ${OCCASION_LIMITS.subject} caracteres.` };
  if (!message) return { ok: false, error: "Escribí el texto del correo." };
  if (message.length > OCCASION_LIMITS.message) return { ok: false, error: `El texto admite hasta ${OCCASION_LIMITS.message} caracteres.` };
  const imageUrl = imagenCruda ? safeHttpsUrl(imagenCruda) : null;
  if (imagenCruda && !imageUrl) return { ok: false, error: "La imagen tiene que ser una dirección que empiece con https://." };

  let month: number | null = null;
  let day: number | null = null;
  let specialties: string[] = [];
  if (base.kind === "EFEMERIDE") {
    month = entero(form.get("month"));
    day = entero(form.get("day"));
    const vacia = month === null && day === null;
    if (!vacia && !isValidMonthDay(month, day)) return { ok: false, error: "La fecha no es válida. Revisá el día y el mes." };
    if (vacia) {
      month = null;
      day = null;
    }
    if (enabled && vacia) return { ok: false, error: "Cargá la fecha antes de encender este saludo." };
    specialties = [...new Set(form.getAll("specialties").map((v) => String(v)).filter((v) => IDS.has(v)))];
  }

  return {
    ok: true,
    row: {
      key: base.key,
      kind: base.kind,
      enabled,
      month,
      day,
      title,
      subject,
      message,
      imageUrl,
      specialties,
      milestonesOnly: base.kind === "ANNIVERSARY" && (form.get("milestonesOnly") === "on" || form.get("milestonesOnly") === "1"),
    },
  };
}
