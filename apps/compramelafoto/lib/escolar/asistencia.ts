/**
 * Pedido de asistencia para configurar el módulo escolar (fotógrafo → soporte).
 *
 * Puro (sin Prisma ni red) para probarlo con node:test. La ruta
 * /api/fotografo/escolar/asistencia usa estas funciones y crea el ticket con
 * la misma lógica que POST /api/support/tickets.
 */

/** Motivo del ticket. Se guarda como código; el panel lo traduce con getSupportReasonLabel. */
export const ESCOLAR_ASISTENCIA_REASON = "SCHOOL_MODULE_ASSISTANCE";
export const ESCOLAR_ASISTENCIA_REASON_LABEL = "Asistencia módulo escolar";

/** Estados en los que un pedido sigue "abierto" (no se crea otro). */
export const ESCOLAR_ASISTENCIA_OPEN_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

export const ESCOLAR_ASISTENCIA_WHATSAPP_NUMBER = "5493413748324";

export const ESCOLAR_ASISTENCIA_PHONE_MAX = 40;
export const ESCOLAR_ASISTENCIA_MESSAGE_MAX = 1500;

/** Texto plano: sin etiquetas HTML ni caracteres de control. */
function cleanText(raw: unknown, maxLen: number): string {
  return String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLen);
}

/** Teléfono/WhatsApp opcional: sólo dígitos, espacios, +, -, paréntesis. Vacío → null. */
export function normalizeAsistenciaPhone(raw: unknown): string | null {
  const text = cleanText(raw, ESCOLAR_ASISTENCIA_PHONE_MAX)
    .replace(/[^\d+\-() ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /\d/.test(text) ? text : null;
}

export function normalizeAsistenciaMessage(raw: unknown): string | null {
  const text = cleanText(raw, ESCOLAR_ASISTENCIA_MESSAGE_MAX);
  return text.length > 0 ? text : null;
}

export type EscolarAsistenciaContext = {
  photographerName: string | null | undefined;
  phone: string | null;
  message: string | null;
  /** Instituciones propias cargadas (School.ownerId). */
  schoolsCount: number;
  publicPageHandler: string | null | undefined;
  isPublicPageEnabled: boolean | null | undefined;
};

/**
 * Descripción del ticket: qué pidió y lo mínimo para ayudarlo. Sin email,
 * DNI, datos bancarios ni nada sensible (el email ya viaja en el ticket).
 */
export function buildEscolarAsistenciaDescription(ctx: EscolarAsistenciaContext): string {
  const name = cleanText(ctx.photographerName, 120);
  const handler = cleanText(ctx.publicPageHandler, 80);
  const schools = Number.isFinite(ctx.schoolsCount) && ctx.schoolsCount > 0 ? Math.floor(ctx.schoolsCount) : 0;

  const landing = handler
    ? ctx.isPublicPageEnabled
      ? `activa en /${handler}/escolar`
      : `dirección /${handler} definida, pero la página pública está apagada`
    : "sin dirección pública definida";

  const lines = [
    "Pedido de asistencia para configurar el módulo escolar (instituciones, preventa, packs, selfie y landing para colegios).",
    "",
    `Fotógrafo: ${name || "(sin nombre)"}`,
    `Teléfono / WhatsApp: ${ctx.phone || "no indicó"}`,
    `Instituciones cargadas: ${schools}`,
    `Landing escolar: ${landing}`,
  ];
  if (ctx.message) {
    lines.push("", "Mensaje del fotógrafo:", ctx.message);
  }
  return lines.join("\n");
}

type TicketLike = { reason: string | null | undefined; status: string | null | undefined };

export function isOpenEscolarAsistenciaTicket(ticket: TicketLike): boolean {
  return (
    ticket.reason === ESCOLAR_ASISTENCIA_REASON &&
    (ESCOLAR_ASISTENCIA_OPEN_STATUSES as readonly string[]).includes(String(ticket.status ?? ""))
  );
}

/** Primer pedido de asistencia escolar todavía abierto, o null. */
export function findOpenEscolarAsistenciaTicket<T extends TicketLike>(tickets: readonly T[]): T | null {
  return tickets.find(isOpenEscolarAsistenciaTicket) ?? null;
}

/** Filtro Prisma del pedido abierto de este usuario (los tickets del fotógrafo se identifican por email). */
export function buildOpenEscolarAsistenciaWhere(email: string) {
  return {
    reason: ESCOLAR_ASISTENCIA_REASON,
    status: { in: [...ESCOLAR_ASISTENCIA_OPEN_STATUSES] },
    requesterEmail: { equals: String(email || "").trim().toLowerCase(), mode: "insensitive" as const },
  };
}

/** Enlace a WhatsApp con el mensaje armado. */
export function buildEscolarAsistenciaWhatsappUrl(name: string | null | undefined): string {
  const clean = cleanText(name, 80);
  const quien = clean ? `soy ${clean} de ComprameLaFoto` : "soy fotógrafo de ComprameLaFoto";
  const text = `Hola, ${quien} y quiero asistencia para configurar mi módulo escolar`;
  return `https://wa.me/${ESCOLAR_ASISTENCIA_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Qué variante del llamador mostrar según el uso del módulo.
 * - "promo": todavía no tiene instituciones → banner de venta completo.
 * - "en-uso": ya tiene instituciones → sólo accesos (landing + asistencia).
 */
export type EscolarPromoMode = "promo" | "en-uso";

export function escolarPromoMode(schoolsCount: number | null | undefined): EscolarPromoMode {
  return typeof schoolsCount === "number" && schoolsCount > 0 ? "en-uso" : "promo";
}
