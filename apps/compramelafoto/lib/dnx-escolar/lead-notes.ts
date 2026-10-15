/**
 * Datos extra de las solicitudes escolares (niveles, origen y UTM) y aviso por email a DNX.
 *
 * `SchoolLead` no tiene columnas para niveles, origen ni UTM: se guardan en `notes` con un
 * formato legible, sin migración. Todo es puro (sin Prisma ni red) para poder probarlo.
 */

export const SCHOOL_LEAD_LEVELS = ["Maternal", "Inicial", "Primario", "Secundario"] as const;
export type SchoolLeadLevel = (typeof SCHOOL_LEAD_LEVELS)[number];

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

/** Origen de la landing de DNX Estudio para colegios. */
export const DNX_ESCOLAR_SOURCE = "dnx-escolar";

const UTM_MAX_LENGTH = 100;
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Saca caracteres de control y signos que no tienen por qué estar en un parámetro de campaña. */
function cleanShortText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f<>"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
  return cleaned ? cleaned : null;
}

/** Deja sólo niveles permitidos, sin repetir y en el orden canónico. */
export function sanitizeLevels(input: unknown): SchoolLeadLevel[] {
  if (!Array.isArray(input)) return [];
  const pedidos = new Set(input.filter((v): v is string => typeof v === "string").map((v) => v.trim()));
  return SCHOOL_LEAD_LEVELS.filter((level) => pedidos.has(level));
}

export function sanitizeSource(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  return SOURCE_PATTERN.test(value) ? value : null;
}

export function sanitizeUtm(input: unknown): UtmParams {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const result: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = cleanShortText(raw[key], UTM_MAX_LENGTH);
    if (value) result[key] = value;
  }
  return result;
}

/**
 * Arma el texto de `notes`. Devuelve null cuando no hay nada que guardar, para que las
 * solicitudes de /escuelas (que no mandan estos campos) queden exactamente como antes.
 *
 * Ejemplo: "Origen: dnx-escolar · Niveles: Inicial, Primario · utm_source=instagram"
 */
export function buildSchoolLeadNotes(input: {
  source?: string | null;
  /** Handler del fotógrafo cuya landing escolar recibió la solicitud. */
  photographerHandler?: string | null;
  levels?: readonly string[];
  utm?: UtmParams;
}): string | null {
  const parts: string[] = [];
  if (input.source) parts.push(`Origen: ${input.source}`);
  if (input.photographerHandler) parts.push(`Landing: /${input.photographerHandler}/escolar`);
  if (input.levels && input.levels.length > 0) parts.push(`Niveles: ${input.levels.join(", ")}`);
  for (const key of UTM_KEYS) {
    const value = input.utm?.[key];
    if (value) parts.push(`${key}=${value}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type DnxEscolarLeadEmailInput = {
  leadId: number;
  schoolName: string;
  city: string;
  contactName: string;
  email: string | null;
  phone: string;
  approxStudents: number | null;
  levels: readonly string[];
  message: string | null;
  utm: UtmParams;
};

/** Arma el aviso (asunto en una sola línea y HTML con todo el contenido escapado). */
function renderEscolarLeadEmail(
  lead: DnxEscolarLeadEmailInput,
  opts: { heading: string; intro: string | null },
): { subject: string; html: string } {
  const subject = `Nueva consulta escolar: ${lead.schoolName} (${lead.city})`.replace(/[\r\n]+/g, " ").slice(0, 200);

  const filas: Array<[string, string]> = [
    ["Institución", lead.schoolName],
    ["Localidad", lead.city],
    ["Contacto", lead.contactName],
    ["Email", lead.email || "—"],
    ["Teléfono / WhatsApp", lead.phone],
    ["Niveles", lead.levels.length > 0 ? lead.levels.join(", ") : "—"],
    ["Alumnos aprox.", lead.approxStudents != null ? String(lead.approxStudents) : "—"],
  ];
  for (const key of UTM_KEYS) {
    const value = lead.utm[key];
    if (value) filas.push([key, value]);
  }

  const filasHtml = filas
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111827">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const mensajeHtml = lead.message
    ? `<p style="margin:16px 0 4px;color:#6b7280">Mensaje</p><p style="margin:0;white-space:pre-wrap;color:#111827">${escapeHtml(lead.message)}</p>`
    : "";

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">` +
    `<h2 style="margin:0 0 12px;font-size:18px;color:#111827">${escapeHtml(opts.heading)}</h2>` +
    (opts.intro ? `<p style="margin:0 0 12px;color:#374151">${escapeHtml(opts.intro)}</p>` : "") +
    `<table style="border-collapse:collapse">${filasHtml}</table>` +
    mensajeHtml +
    `<p style="margin:20px 0 0;color:#6b7280;font-size:12px">Solicitud n.º ${escapeHtml(String(lead.leadId))} guardada en ComprameLaFoto (SchoolLead).</p>` +
    `</div>`;

  return { subject, html };
}

/** Aviso interno a DNX: asunto en una sola línea y HTML con todo el contenido escapado. */
export function buildDnxEscolarLeadEmail(lead: DnxEscolarLeadEmailInput): { subject: string; html: string } {
  return renderEscolarLeadEmail(lead, {
    heading: "Nueva consulta desde /dnx/escolar",
    intro: null,
  });
}

/**
 * Aviso al fotógrafo cuando un colegio completa el formulario de su landing `/<handler>/escolar`.
 * La solicitud también queda en su panel (SchoolLead con referredByUserId = fotógrafo).
 */
export function buildPhotographerEscolarLeadEmail(
  lead: DnxEscolarLeadEmailInput & { photographerName: string; photographerHandler: string },
): { subject: string; html: string } {
  return renderEscolarLeadEmail(lead, {
    heading: `Nueva consulta desde tu landing escolar (/${lead.photographerHandler}/escolar)`,
    intro: `Hola ${lead.photographerName}: un colegio completó el formulario de tu landing escolar. Respondé a este correo para escribirle${lead.email ? "" : " (no dejó email: contactalo por teléfono)"}.`,
  });
}
