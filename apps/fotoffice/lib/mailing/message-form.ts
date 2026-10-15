import { ESPECIALIDADES } from "@/lib/membership/specialties";
import { safeHttpsUrl } from "./layout";

/**
 * Validación del formulario de una campaña libre. Módulo puro.
 */

export const MESSAGE_LIMITS = { name: 120, subject: 150, body: 10000, ctaLabel: 40 } as const;

const ESPECIALIDAD_IDS = new Set<string>(ESPECIALIDADES.map((e) => e.id));
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

export type MessageFields = {
  name: string;
  subject: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  categoryIds: string[];
  specialties: string[];
  scheduledAt: Date | null;
};

function texto(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
}

/** "2026-10-20T09:30" en hora argentina → instante UTC. null si está vacío; NaN-Date si es inválido. */
export function parseArgentinaDateTime(value: string): Date | null | "INVALID" {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return "INVALID";
  const [, y, mo, d, h, mi] = m.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) + AR_OFFSET_MS;
  const fecha = new Date(utc);
  // Rechaza 31/02 y similares: el Date "se corre" de mes.
  const vuelta = new Date(utc - AR_OFFSET_MS);
  if (vuelta.getUTCMonth() !== mo - 1 || vuelta.getUTCDate() !== d || h > 23 || mi > 59) return "INVALID";
  return fecha;
}

/** Instante UTC → valor de un `<input type="datetime-local">` en hora argentina. */
export function toArgentinaInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() - AR_OFFSET_MS).toISOString().slice(0, 16);
}

export function parseMessageForm(
  form: FormData,
  validCategoryIds: Set<string>,
): { ok: true; fields: MessageFields } | { ok: false; error: string } {
  const name = texto(form.get("name"));
  const subject = texto(form.get("subject"));
  const body = texto(form.get("body"));
  const imagenCruda = texto(form.get("imageUrl"));
  const ctaLabel = texto(form.get("ctaLabel"));
  const ctaCruda = texto(form.get("ctaUrl"));

  if (!name) return { ok: false, error: "Poné un nombre para reconocer la campaña." };
  if (name.length > MESSAGE_LIMITS.name) return { ok: false, error: `El nombre admite hasta ${MESSAGE_LIMITS.name} caracteres.` };
  if (subject.length > MESSAGE_LIMITS.subject) return { ok: false, error: `El asunto admite hasta ${MESSAGE_LIMITS.subject} caracteres.` };
  if (body.length > MESSAGE_LIMITS.body) return { ok: false, error: `El texto admite hasta ${MESSAGE_LIMITS.body} caracteres.` };
  if (ctaLabel.length > MESSAGE_LIMITS.ctaLabel) return { ok: false, error: `El texto del botón admite hasta ${MESSAGE_LIMITS.ctaLabel} caracteres.` };

  const imageUrl = imagenCruda ? safeHttpsUrl(imagenCruda) : null;
  if (imagenCruda && !imageUrl) return { ok: false, error: "La imagen tiene que ser una dirección que empiece con https://." };
  const ctaUrl = ctaCruda ? safeHttpsUrl(ctaCruda) : null;
  if (ctaCruda && !ctaUrl) return { ok: false, error: "La dirección del botón tiene que empezar con https://." };
  if (Boolean(ctaLabel) !== Boolean(ctaUrl)) return { ok: false, error: "El botón necesita el texto y la dirección, o ninguno de los dos." };

  const programada = parseArgentinaDateTime(texto(form.get("scheduledAt")));
  if (programada === "INVALID") return { ok: false, error: "La fecha y hora de envío no es válida." };

  return {
    ok: true,
    fields: {
      name,
      subject,
      body,
      imageUrl,
      ctaLabel: ctaLabel || null,
      ctaUrl,
      categoryIds: [...new Set(form.getAll("categoryIds").map(String).filter((id) => validCategoryIds.has(id)))],
      specialties: [...new Set(form.getAll("specialties").map(String).filter((id) => ESPECIALIDAD_IDS.has(id)))],
      scheduledAt: programada,
    },
  };
}

/** Lo que tiene que estar antes de mandar (un borrador puede guardarse incompleto). */
export function readyToSend(m: { subject: string; body: string }): string | null {
  if (!m.subject.trim()) return "Falta el asunto.";
  if (!m.body.trim()) return "Falta el texto.";
  return null;
}
