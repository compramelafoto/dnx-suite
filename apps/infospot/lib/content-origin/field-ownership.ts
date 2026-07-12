/**
 * Ownership de campos: quién controla cada dato en sync.
 *
 * SOURCE — la fuente externa puede actualizar en inbound.
 * INFOSPOT — solo redacción; sync no sobrescribe.
 * INFOSPOT_AFTER_OVERRIDE — la fuente aporta valor inicial; si hay override editorial, no pisa.
 */

export type FieldOwner = "SOURCE" | "INFOSPOT" | "INFOSPOT_AFTER_OVERRIDE";

/**
 * Campos operativos típicos de un evento (mapeo conceptual Info Spot ↔ origen).
 * No todos existen aún como columnas; el mapa guía sync futuro.
 */
export const EVENT_FIELD_OWNERSHIP = {
  startAt: "SOURCE",
  endAt: "SOURCE",
  city: "SOURCE",
  province: "SOURCE",
  address: "SOURCE",
  venueName: "SOURCE",
  latitude: "SOURCE",
  longitude: "SOURCE",
  registrationUrl: "SOURCE",
  organizerName: "SOURCE",
  organizerEmail: "SOURCE",
  organizerPhone: "SOURCE",
  organizerWebsite: "SOURCE",
  joinPolicy: "SOURCE",
  maxPhotographers: "SOURCE",
  commercialAvailability: "SOURCE",
  title: "INFOSPOT",
  summary: "INFOSPOT",
  description: "INFOSPOT",
  categoryId: "INFOSPOT_AFTER_OVERRIDE",
  seoTitle: "INFOSPOT",
  seoDescription: "INFOSPOT",
  contentTag: "INFOSPOT",
  status: "INFOSPOT",
  coverImageUrl: "INFOSPOT_AFTER_OVERRIDE",
  coverImageKey: "INFOSPOT_AFTER_OVERRIDE",
} as const satisfies Record<string, FieldOwner>;

export const ARTICLE_FIELD_OWNERSHIP = {
  eventLinkedMeta: "SOURCE",
  albumCommercialMeta: "SOURCE",
  title: "INFOSPOT",
  excerpt: "INFOSPOT",
  content: "INFOSPOT",
  seoTitle: "INFOSPOT",
  seoDescription: "INFOSPOT",
  status: "INFOSPOT",
  contentTag: "INFOSPOT",
  coverImageId: "INFOSPOT_AFTER_OVERRIDE",
} as const satisfies Record<string, FieldOwner>;

export function isSourceOwned(field: string, map: Record<string, FieldOwner>): boolean {
  return map[field] === "SOURCE";
}

export function isEditorialProtected(field: string, map: Record<string, FieldOwner>): boolean {
  const owner = map[field];
  return owner === "INFOSPOT" || owner === "INFOSPOT_AFTER_OVERRIDE";
}

/**
 * Merge operativo: solo aplica keys SOURCE del payload.
 * Nunca muta el objeto editorial pasado.
 */
export function mergeOperationalFields<T extends Record<string, unknown>>(
  currentEditorial: T,
  incomingOperational: Record<string, unknown>,
  ownership: Record<string, FieldOwner>,
  opts?: { coverOverridden?: boolean },
): { nextOperational: Record<string, unknown>; editorialUntouched: T } {
  const nextOperational: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incomingOperational)) {
    const owner = ownership[key];
    if (owner === "SOURCE") {
      nextOperational[key] = value;
      continue;
    }
    if (owner === "INFOSPOT_AFTER_OVERRIDE") {
      if (opts?.coverOverridden) continue;
      nextOperational[key] = value;
    }
  }
  // Copia superficial para demostrar que no se altera la referencia editorial.
  return {
    nextOperational,
    editorialUntouched: { ...currentEditorial },
  };
}

/**
 * Override editorial de portada (etapa futura):
 * marcar en operationalPayload o columna dedicada `coverOverriddenAt`.
 * Mientras tanto, ownership INFOSPOT_AFTER_OVERRIDE + flag en merge.
 */
export const COVER_OVERRIDE_DOC =
  "Si el redactor reemplaza la portada, setear coverOverridden=true en el merge; el origen no vuelve a pisar coverImage*.";
