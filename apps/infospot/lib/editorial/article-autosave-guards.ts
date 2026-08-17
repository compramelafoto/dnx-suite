/**
 * Reglas puras de "qué persistir" en un autosave de borrador. Sin Next ni
 * Prisma: un campo ausente o vacío en el payload nunca debe interpretarse
 * como una eliminación — salvo que el redactor la haya pedido explícitamente
 * (locationCleared / coverImageCleared). Ver apps/infospot/app/actions/articles.ts.
 */
import { isGeographicScope } from "./article-location";

export const LOCATION_RAW_KEYS = [
  "geographicScope",
  "countryCode",
  "countryName",
  "province",
  "city",
  "placeName",
  "address",
  "formattedAddress",
  "latitude",
  "longitude",
] as const;

const LOCATION_TEXT_FIELDS = [
  "countryCode",
  "countryName",
  "province",
  "city",
  "placeName",
  "address",
  "formattedAddress",
] as const;

export type ExistingLocationForGuard = {
  geographicScope: string | null;
  countryCode: string | null;
  countryName: string | null;
  province: string | null;
  city: string | null;
  placeName: string | null;
  address: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function locationKeysPresentInRaw(raw: Record<string, string>): Set<string> {
  const present = new Set<string>();
  for (const key of LOCATION_RAW_KEYS) {
    if (key in raw) present.add(key);
  }
  return present;
}

/**
 * Decide qué claves de ubicación realmente se escriben en este autosave.
 * Un valor ausente o vacío en el payload NUNCA borra un valor ya persistido,
 * salvo que `locationCleared` marque una eliminación explícita («Limpiar
 * ubicación»).
 */
export function resolveLocationPresentKeys(
  raw: Record<string, string>,
  existing: ExistingLocationForGuard,
  locationCleared: boolean,
): Set<string> {
  const present = locationKeysPresentInRaw(raw);
  if (locationCleared) return present;

  if (
    present.has("geographicScope") &&
    !isGeographicScope(raw.geographicScope) &&
    existing.geographicScope
  ) {
    present.delete("geographicScope");
  }

  for (const key of LOCATION_TEXT_FIELDS) {
    if (present.has(key) && !(raw[key] ?? "").trim() && existing[key]) {
      present.delete(key);
    }
  }

  const incomingHasCoords = Boolean((raw.latitude ?? "").trim() && (raw.longitude ?? "").trim());
  const existingHasCoords = existing.latitude != null && existing.longitude != null;
  if (
    (present.has("latitude") || present.has("longitude")) &&
    !incomingHasCoords &&
    existingHasCoords
  ) {
    present.delete("latitude");
    present.delete("longitude");
  }

  return present;
}

/**
 * Igual criterio que la ubicación: un coverImageId ausente/vacío en el
 * payload conserva la portada ya persistida. Solo se borra con una
 * eliminación explícita (`coverImageCleared`).
 */
export function resolveAutosaveCoverImageId(
  incoming: string | null,
  existingCoverImageId: string | null,
  coverImageCleared: boolean,
): string | null {
  if (incoming) return incoming;
  if (coverImageCleared) return null;
  return existingCoverImageId;
}

/**
 * Un autosave con cuerpo vacío nunca debe borrar un cuerpo ya persistido:
 * puede ser un payload atrasado o un ciclo de hidratación incompleto.
 */
export function resolveAutosaveContent(
  incomingContent: string,
  existingContent: string | null | undefined,
): string {
  const preserve = !incomingContent.trim() && Boolean(existingContent?.trim());
  return preserve ? (existingContent as string) : incomingContent;
}

/** Un categoryId ausente/vacío conserva la categoría ya elegida. */
export function resolveAutosaveCategoryId(
  incoming: string | null,
  existingCategoryId: string | null,
): string | null {
  return incoming || existingCategoryId || null;
}
