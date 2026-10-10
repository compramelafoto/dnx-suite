/**
 * Muestras Fotográficas (muestrasfotograficas.com) → InfoSpotEvent. Reglas puras, sin base.
 *
 * Muestras publica sus actividades aprobadas en `GET /api/public/actividades`; acá se valida esa
 * respuesta, se decide qué se importa y se arma lo que se escribe en el evento.
 */

export const MUESTRAS_BASE_URL = "https://muestrasfotograficas.com";
export const MUESTRAS_FEED_URL = `${MUESTRAS_BASE_URL}/api/public/actividades`;
/** Prefijo de `InfoSpotContentOrigin.externalId`: el `sourceType` es API y lo comparten otras fuentes. */
export const MUESTRAS_EXTERNAL_PREFIX = "muestras:";
/** `organizerEmail` es obligatorio y nunca se muestra: va la casilla de DNX, no la de nadie. */
export const MUESTRAS_ORGANIZER_EMAIL = "muestras@dnxsuite.com";
export const MUESTRAS_CATEGORY_SLUG = "fotografia";

export type MuestraFeedItem = {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string;
  organizersText: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  scheduleText: string | null;
  priceText: string | null;
  isVirtualOnly: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  url: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Valida la respuesta entera. Lanza si no es la forma esperada: una lista vacía por un error
 * NO puede llegar a la sync, porque retiraría todas las muestras de InfoSpot.
 */
export function parseMuestrasFeed(json: unknown): MuestraFeedItem[] {
  if (!json || typeof json !== "object") throw new Error("Respuesta de Muestras inválida.");
  const o = json as { v?: unknown; items?: unknown };
  if (o.v !== 1 || !Array.isArray(o.items)) throw new Error("Respuesta de Muestras con formato desconocido.");
  const items: MuestraFeedItem[] = [];
  for (const raw of o.items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = str(r.id), slug = str(r.slug), title = str(r.title), url = str(r.url);
    const startsAt = str(r.startsAt), endsAt = str(r.endsAt);
    if (!id || !slug || !title || !url || !startsAt || !endsAt) continue;
    if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) continue;
    if (!url.startsWith(`${MUESTRAS_BASE_URL}/`)) continue;
    items.push({
      id, slug, title, url, startsAt, endsAt,
      type: str(r.type) ?? "OTRA",
      description: str(r.description) ?? "",
      organizersText: str(r.organizersText) ?? "",
      coverImageUrl: str(r.coverImageUrl),
      scheduleText: str(r.scheduleText),
      priceText: str(r.priceText),
      isVirtualOnly: r.isVirtualOnly === true,
      venueName: str(r.venueName),
      address: str(r.address),
      city: str(r.city),
      province: str(r.province),
      latitude: num(r.latitude),
      longitude: num(r.longitude),
      updatedAt: str(r.updatedAt) ?? startsAt,
    });
  }
  return items;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Las 24 jurisdicciones, como las escribe Muestras (y sus formas habituales). */
const PROVINCIAS_AR = new Set(
  [
    "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "CABA", "Capital Federal", "Catamarca", "Chaco", "Chubut",
    "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
    "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
    "Tierra del Fuego", "Tucumán",
  ].map(fold),
);

/**
 * Muestras también lista muestras de otros países (en "provincia" va el país: "Uruguay", "Brasil").
 * Info Spot es una agenda argentina: sólo pasan las de provincias argentinas.
 */
export function isArgentineProvince(province: string | null): boolean {
  if (!province) return false;
  const p = fold(province);
  return PROVINCIAS_AR.has(p) || p.startsWith("tierra del fuego");
}

/** InfoSpot exige ciudad, provincia y un punto en el mapa para publicar. */
export function isMuestraImportable(a: MuestraFeedItem): { importable: boolean; reason?: string } {
  if (a.isVirtualOnly) return { importable: false, reason: "Sólo virtual" };
  if (!a.city?.trim() || !a.province?.trim()) return { importable: false, reason: "Sin ciudad o provincia" };
  if (!isArgentineProvince(a.province)) return { importable: false, reason: "Fuera de Argentina" };
  if (a.latitude == null || a.longitude == null || (a.latitude === 0 && a.longitude === 0)) {
    return { importable: false, reason: "Sin punto en el mapa" };
  }
  return { importable: true };
}

export type NormalizedMuestra = {
  externalId: string;
  title: string;
  summary: string | null;
  description: string;
  startAt: Date;
  endAt: Date;
  venueName: string | null;
  city: string;
  province: string;
  address: string | null;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  sourceUrl: string;
  registrationUrl: string;
  organizerName: string;
  organizerEmail: string;
  organizerWebsite: string;
  sourceUpdatedAt: Date;
  operationalPayload: Record<string, unknown>;
};

function resumen(texto: string): string | null {
  const t = texto.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= 240) return t;
  const corte = t.slice(0, 240);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > 160 ? corte.slice(0, espacio) : corte).trim()}…`;
}

/** Descripción del evento: la de la muestra más horario y entrada, que en InfoSpot no tienen campo. */
function descripcion(a: MuestraFeedItem): string {
  const partes = [a.description.trim()];
  const datos = [
    a.scheduleText?.trim() ? `Horarios: ${a.scheduleText.trim()}` : null,
    `Entrada: ${a.priceText?.trim() || "libre y gratuita"}`,
  ].filter(Boolean);
  partes.push(datos.join("\n"));
  partes.push(`Más información y obras en ${a.url}`);
  return partes.filter(Boolean).join("\n\n");
}

/** Llamar sólo con una actividad importable (`isMuestraImportable`). */
export function normalizeMuestra(a: MuestraFeedItem): NormalizedMuestra {
  return {
    externalId: `${MUESTRAS_EXTERNAL_PREFIX}${a.id}`,
    title: a.title.trim(),
    summary: resumen(a.description),
    description: descripcion(a),
    startAt: new Date(a.startsAt),
    endAt: new Date(a.endsAt),
    venueName: a.venueName?.trim() || null,
    city: a.city!.trim(),
    province: a.province!.trim(),
    address: a.address?.trim() || null,
    latitude: a.latitude!,
    longitude: a.longitude!,
    coverImageUrl: a.coverImageUrl,
    sourceUrl: a.url,
    registrationUrl: a.url,
    organizerName: a.organizersText.trim() || "Muestras Fotográficas",
    organizerEmail: MUESTRAS_ORGANIZER_EMAIL,
    organizerWebsite: MUESTRAS_BASE_URL,
    sourceUpdatedAt: new Date(a.updatedAt),
    operationalPayload: {
      source: "muestrasfotograficas.com",
      slug: a.slug,
      type: a.type,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      scheduleText: a.scheduleText,
      priceText: a.priceText,
      updatedAt: a.updatedAt,
    },
  };
}

export type ExistingMuestraEvent = {
  title: string;
  summary: string | null;
  description: string;
  categoryId: string | null;
  coverImageUrl: string | null;
  startAt: Date;
  endAt: Date | null;
  venueName: string | null;
  city: string;
  province: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
  registrationUrl: string | null;
  organizerName: string;
  organizerWebsite: string | null;
  titleOverridden: boolean;
  descriptionOverridden: boolean;
  summaryOverridden: boolean;
  categoryOverridden: boolean;
  coverOverridden: boolean;
  locationOverridden: boolean;
  coordinatesOverridden: boolean;
};

const igual = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

/**
 * Qué cambiar de un evento ya importado. Fechas y enlaces siempre; lo editorial y la ubicación
 * sólo si la redacción no los editó a mano. Nunca el estado editorial.
 */
export function buildMuestraUpdate(
  existing: ExistingMuestraEvent,
  n: NormalizedMuestra,
  categoryId: string | null,
): { data: Record<string, unknown>; applied: string[] } {
  const data: Record<string, unknown> = {};
  const applied: string[] = [];
  const set = (field: keyof ExistingMuestraEvent, next: unknown, cuando = true) => {
    if (cuando && !igual(existing[field], next)) {
      data[field] = next;
      applied.push(`${field} changed`);
    }
  };

  set("startAt", n.startAt);
  set("endAt", n.endAt);
  set("sourceUrl", n.sourceUrl);
  set("registrationUrl", n.registrationUrl);
  set("organizerName", n.organizerName);
  set("organizerWebsite", n.organizerWebsite);

  set("title", n.title, !existing.titleOverridden);
  set("description", n.description, !existing.descriptionOverridden);
  set("summary", n.summary, !existing.summaryOverridden);
  set("categoryId", categoryId, !existing.categoryOverridden && categoryId != null);
  set("coverImageUrl", n.coverImageUrl, !existing.coverOverridden);

  const lugar = !existing.locationOverridden;
  set("venueName", n.venueName, lugar);
  set("city", n.city, lugar);
  set("province", n.province, lugar);
  set("address", n.address, lugar);
  const punto = !existing.coordinatesOverridden && !existing.locationOverridden;
  set("latitude", n.latitude, punto);
  set("longitude", n.longitude, punto);

  return { data, applied };
}
