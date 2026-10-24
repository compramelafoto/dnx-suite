/**
 * Validación pura del perfil de escuela que puede editar un organizador.
 *
 * El organizador sólo puede tocar datos de contacto y de ubicación. Nombre,
 * slug, dueño (fotógrafo), notas internas del fotógrafo y cualquier otro campo
 * quedan fuera: si llegan en el cuerpo, se rechaza el pedido completo.
 */

export const SCHOOL_ORGANIZER_PROFILE_FIELDS = [
  "contactEmail",
  "contactPhone",
  "address",
  "city",
  "province",
  "country",
] as const;

export type SchoolOrganizerProfileField = (typeof SCHOOL_ORGANIZER_PROFILE_FIELDS)[number];

/** `logoUrl` sólo se acepta en null (quitar el logo); para cambiarlo se usa la subida. */
const ALLOWED_KEYS = new Set<string>([...SCHOOL_ORGANIZER_PROFILE_FIELDS, "logoUrl"]);

export const SCHOOL_ORGANIZER_PROFILE_MAX_LENGTH: Record<SchoolOrganizerProfileField, number> = {
  contactEmail: 254,
  contactPhone: 40,
  address: 300,
  city: 120,
  province: 120,
  country: 120,
};

const FIELD_LABELS: Record<SchoolOrganizerProfileField, string> = {
  contactEmail: "El email de contacto",
  contactPhone: "El teléfono de contacto",
  address: "La dirección",
  city: "La localidad",
  province: "La provincia",
  country: "El país",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[0-9+()\-.\s]+$/;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

export type SchoolOrganizerProfileUpdate = Partial<Record<SchoolOrganizerProfileField, string | null>> & {
  logoUrl?: null;
};

export type SchoolOrganizerProfileParseResult =
  | { ok: true; data: SchoolOrganizerProfileUpdate }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSchoolOrganizerProfilePatch(body: unknown): SchoolOrganizerProfileParseResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Cuerpo inválido" };
  }

  const forbidden = Object.keys(body).filter((key) => !ALLOWED_KEYS.has(key));
  if (forbidden.length > 0) {
    return {
      ok: false,
      error: `No podés modificar estos datos: ${forbidden.join(", ")}`,
    };
  }

  const data: SchoolOrganizerProfileUpdate = {};

  for (const field of SCHOOL_ORGANIZER_PROFILE_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === undefined) {
      data[field] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return { ok: false, error: `${FIELD_LABELS[field]} tiene un formato inválido` };
    }
    const value = raw.trim().replace(/\s+/g, " ");
    if (value === "") {
      data[field] = null;
      continue;
    }
    if (CONTROL_CHARS_RE.test(value)) {
      return { ok: false, error: `${FIELD_LABELS[field]} tiene caracteres inválidos` };
    }
    const max = SCHOOL_ORGANIZER_PROFILE_MAX_LENGTH[field];
    if (value.length > max) {
      return { ok: false, error: `${FIELD_LABELS[field]} no puede superar ${max} caracteres` };
    }
    if (field === "contactEmail" && !EMAIL_RE.test(value)) {
      return { ok: false, error: "El email de contacto no es válido" };
    }
    if (field === "contactPhone") {
      const digits = value.replace(/\D/g, "").length;
      if (!PHONE_CHARS_RE.test(value) || digits < 6 || digits > 20) {
        return {
          ok: false,
          error: "El teléfono de contacto no es válido (usá sólo números, espacios, +, - y paréntesis)",
        };
      }
    }
    data[field] = field === "contactEmail" ? value.toLowerCase() : value;
  }

  if ("logoUrl" in body) {
    if (body.logoUrl !== null && body.logoUrl !== "") {
      return { ok: false, error: "Para cambiar el logo usá la opción «Subir logo»" };
    }
    data.logoUrl = null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No hay cambios para guardar" };
  }

  return { ok: true, data };
}

/**
 * Si cambia la dirección, las coordenadas guardadas dejan de corresponder:
 * se limpian para no mostrar un punto equivocado en el mapa.
 */
export function shouldClearSchoolCoordinates(
  update: SchoolOrganizerProfileUpdate,
  current: { address: string | null }
): boolean {
  if (!("address" in update)) return false;
  return (update.address ?? null) !== (current.address ?? null);
}

/** Campos del perfil de escuela que el organizador puede ver y editar. */
export const SCHOOL_ORGANIZER_PROFILE_SELECT = {
  id: true,
  name: true,
  contactEmail: true,
  contactPhone: true,
  address: true,
  city: true,
  province: true,
  country: true,
  logoUrl: true,
} as const;
