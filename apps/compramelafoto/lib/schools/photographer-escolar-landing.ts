/**
 * Panel "Mi landing escolar" del fotógrafo: qué le falta a su landing pública
 * (`/<publicPageHandler>/escolar`) y la consulta de sus solicitudes de colegios.
 *
 * Todo es puro (sin Prisma ni red) para poder probarlo con node:test.
 */

export const ESCOLAR_LANDING_BASE_URL = "https://www.compramelafoto.com";

/** Datos del fotógrafo que importan para la landing escolar. */
export type EscolarLandingProfile = {
  role: string | null | undefined;
  publicPageHandler: string | null | undefined;
  isPublicPageEnabled: boolean | null | undefined;
  logoUrl: string | null | undefined;
  whatsapp: string | null | undefined;
  phone: string | null | undefined;
  companyName: string | null | undefined;
};

export type EscolarLandingChecklistItemId =
  | "public-page"
  | "handler"
  | "logo"
  | "contact"
  | "company-name";

export type EscolarLandingChecklistItem = {
  id: EscolarLandingChecklistItemId;
  label: string;
  hint: string;
  done: boolean;
  /** Si falta, la landing no existe (no sólo se ve peor). */
  required: boolean;
  /** Pantalla donde se completa. */
  href: string;
};

export type EscolarLandingStatus = {
  /** La landing existe y se puede abrir. */
  available: boolean;
  /** URL absoluta de la landing, o null si falta el handler. */
  url: string | null;
  /** Explicación de por qué no está disponible (null si lo está). */
  unavailableReason: string | null;
  checklist: EscolarLandingChecklistItem[];
  pendingCount: number;
};

const CONFIG_DATOS = "/fotografo/configuracion?tab=datos";
const CONFIG_DISENO = "/fotografo/configuracion?tab=diseno";

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** URL pública de la landing escolar (null si no hay handler). */
export function buildEscolarLandingUrl(handler: string | null | undefined): string | null {
  if (!hasText(handler)) return null;
  const clean = String(handler).trim().toLowerCase();
  return `${ESCOLAR_LANDING_BASE_URL}/${encodeURIComponent(clean)}/escolar`;
}

export function buildEscolarLandingChecklist(profile: EscolarLandingProfile): EscolarLandingChecklistItem[] {
  return [
    {
      id: "handler",
      label: "Dirección pública definida",
      hint: "Es lo que va después de compramelafoto.com/ (por ejemplo, el nombre de tu estudio).",
      done: hasText(profile.publicPageHandler),
      required: true,
      href: CONFIG_DISENO,
    },
    {
      id: "public-page",
      label: "Página pública activada",
      hint: "Sin la página pública encendida, la landing escolar no se muestra.",
      done: profile.isPublicPageEnabled === true,
      required: true,
      href: CONFIG_DISENO,
    },
    {
      id: "logo",
      label: "Logo cargado",
      hint: "Los colegios ven tu logo arriba de la landing.",
      done: hasText(profile.logoUrl),
      required: false,
      href: CONFIG_DISENO,
    },
    {
      id: "contact",
      label: "WhatsApp o teléfono",
      hint: "Para que el colegio pueda contactarte directo.",
      done: hasText(profile.whatsapp) || hasText(profile.phone),
      required: false,
      href: CONFIG_DATOS,
    },
    {
      id: "company-name",
      label: "Nombre comercial",
      hint: "El nombre con el que te presentás ante el colegio.",
      done: hasText(profile.companyName),
      required: false,
      href: CONFIG_DATOS,
    },
  ];
}

export function buildEscolarLandingStatus(profile: EscolarLandingProfile): EscolarLandingStatus {
  const checklist = buildEscolarLandingChecklist(profile);
  const url = buildEscolarLandingUrl(profile.publicPageHandler);

  let unavailableReason: string | null = null;
  if (!hasText(profile.publicPageHandler)) {
    unavailableReason =
      "Todavía no elegiste tu dirección pública. Definila en Configuración → Preferencias y marca y guardá.";
  } else if (profile.isPublicPageEnabled !== true) {
    unavailableReason =
      "Tu página pública está apagada. Encendela en Configuración → Preferencias y marca y guardá.";
  } else if (profile.role !== "PHOTOGRAPHER") {
    // La landing (como la página pública) sólo se sirve para cuentas con rol PHOTOGRAPHER.
    unavailableReason = "La landing escolar está disponible sólo para cuentas de fotógrafo.";
  }

  return {
    available: unavailableReason === null,
    url,
    unavailableReason,
    checklist,
    pendingCount: checklist.filter((item) => !item.done).length,
  };
}

/**
 * Filtro de la consulta de solicitudes de colegios del fotógrafo.
 * Aislamiento estricto: siempre filtra por el usuario logueado; si el id no es válido, lanza.
 */
export function buildPhotographerSchoolLeadsWhere(userId: number): { referredByUserId: number } {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usuario inválido para consultar solicitudes de colegios");
  }
  return { referredByUserId: userId };
}

export const SCHOOL_LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  IN_PROGRESS: "En curso",
  CONVERTED: "Convertida",
  DISCARDED: "Descartada",
};

export function schoolLeadStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return SCHOOL_LEAD_STATUS_LABELS[status] ?? status;
}

/** Fecha y hora en hora argentina, ej. "13/10/2026 14:05". */
export function formatLeadDateAR(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
