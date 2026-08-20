import { MEMBER_STATUS_LABELS, isMemberStatus } from "./status-labels";

/** Nunca mostrar el enum técnico al usuario — mismo criterio que MEMBER_STATUS_LABELS. */
export const MEMBER_AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: "Alta manual",
  UPDATED: "Datos modificados",
  STATUS_CHANGED: "Cambio de estado",
  IMPORTED: "Alta por importación",
  USER_LINKED: "Usuario vinculado",
  USER_UNLINKED: "Usuario desvinculado",
};

export const MEMBER_AUDIT_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  CSV_IMPORT: "Importación CSV",
  SYSTEM: "Automático",
};

/** Nombres legibles de los campos auditados, para no mostrar identificadores del schema. */
export const MEMBER_FIELD_LABELS: Record<string, string> = {
  memberNumber: "Número de socio",
  categoryId: "Categoría",
  firstName: "Nombre",
  lastName: "Apellido",
  documentType: "Tipo de documento",
  documentNumber: "Número de documento",
  email: "Email",
  phone: "Teléfono",
  avatarUrl: "Fotografía",
  birthDate: "Fecha de nacimiento",
  address: "Domicilio",
  city: "Ciudad",
  province: "Provincia",
  postalCode: "Código postal",
  joinedAt: "Fecha de ingreso",
  leftAt: "Fecha de baja",
  status: "Estado",
  notes: "Observaciones",
  userId: "Usuario vinculado",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;

/** Convierte un valor del historial a algo legible: fechas con formato, estados traducidos, vacío explícito. */
export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vacío";
  if (field === "status" && typeof value === "string" && isMemberStatus(value)) {
    return MEMBER_STATUS_LABELS[value];
  }
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
    }
  }
  if (field === "avatarUrl") return "actualizada";
  return String(value);
}

export function memberFieldLabel(field: string): string {
  return MEMBER_FIELD_LABELS[field] ?? field;
}
