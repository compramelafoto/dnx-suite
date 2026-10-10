import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@repo/db";
import { createNominatimProvider } from "@repo/geo/nominatim";
import {
  ACTIVITY_TYPE_LABELS,
  dateRangeText,
  distanceLabel,
  isActivityType,
  isLastDays,
  nearHref,
  pickNearbyForPortal,
} from "@repo/muestras";
import { candidatosDeOrigen, nombreDeLugar } from "./origen";

/**
 * "Muestras fotográficas cerca tuyo" del portal del socio.
 *
 * Las muestras viven en la misma base que FOTOFFICE (las carga muestrasfotograficas.com), así que
 * se leen directo. Lo único de afuera es pasar la ciudad del socio a coordenadas: se le pregunta
 * una vez por ciudad a Nominatim y la respuesta queda en el caché de Next por 30 días.
 */

export const MUESTRAS_URL = "https://muestrasfotograficas.com";

type Coords = { latitude: number; longitude: number };

export type MuestraCercaView = {
  slug: string;
  title: string;
  typeLabel: string;
  coverImageUrl: string | null;
  city: string | null;
  distanceLabel: string | null;
  dateText: string;
  lastDays: boolean;
  url: string;
};

export type MuestrasCerca = {
  /** "Rosario". Null = no se pudo saber dónde vive: se muestran las del país por fecha. */
  lugar: string | null;
  items: MuestraCercaView[];
  verTodasUrl: string;
};

const ESPERA_MS = 3000;

/**
 * Un texto → coordenadas, o null si Nominatim no lo encuentra (eso también se guarda: no tiene
 * sentido preguntar de nuevo por "Rosarioo"). Si Nominatim falla, lanza y no se guarda nada.
 */
const geocodificar = unstable_cache(
  async (texto: string): Promise<Coords | null> => {
    const lugares = await createNominatimProvider({
      userAgent: "FOTOFFICE/1.0 (dnx-suite; muestras cerca del socio)",
      fetchImpl: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) }),
    }).search(texto, { limit: 1, countryCode: "ar" });
    const p = lugares[0];
    return p ? { latitude: p.latitude, longitude: p.longitude } : null;
  },
  ["fotoffice-geocode-lugar-v1"],
  { revalidate: 60 * 60 * 24 * 30 },
);

async function resolverOrigen(candidatos: string[]): Promise<{ texto: string; coords: Coords } | null> {
  for (const texto of candidatos) {
    try {
      // En minúsculas: "Santa Fe" y "santa fe" son el mismo lugar y la misma entrada del caché.
      const coords = await geocodificar(texto.toLowerCase());
      if (coords) return { texto, coords };
    } catch (error) {
      console.error("[fotoffice][muestras-cerca] no se pudo ubicar el lugar", {
        detalle: error instanceof Error ? error.message : "error desconocido",
      });
    }
  }
  return null;
}

export async function loadMuestrasCerca(params: { memberId: string; workspaceId: string }): Promise<MuestrasCerca> {
  const now = new Date();
  const [socio, institucion, actividades] = await Promise.all([
    prisma.member.findUnique({ where: { id: params.memberId }, select: { city: true, province: true } }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: params.workspaceId },
      select: { city: true, province: true },
    }),
    prisma.culturalActivity.findMany({
      where: { reviewStatus: "APPROVED", isCancelled: false, isVirtualOnly: false, endsAt: { gt: now }, latitude: { not: null } },
      select: {
        slug: true, type: true, title: true, coverImageUrl: true, city: true,
        startsAt: true, endsAt: true, latitude: true, longitude: true, isCancelled: true, isVirtualOnly: true,
      },
      orderBy: { startsAt: "asc" },
      take: 500,
    }),
  ]);

  const origen = await resolverOrigen(candidatosDeOrigen(socio ?? {}, institucion));
  const elegidas = pickNearbyForPortal(origen?.coords ?? null, actividades, now);
  const lugar = origen ? nombreDeLugar(origen.texto) : null;

  return {
    lugar,
    items: elegidas.map((a) => ({
      slug: a.slug,
      title: a.title,
      typeLabel: isActivityType(a.type) ? ACTIVITY_TYPE_LABELS[a.type] : "Actividad",
      coverImageUrl: a.coverImageUrl,
      city: a.city,
      distanceLabel: distanceLabel(a.distanceKm),
      dateText: dateRangeText(a.startsAt, a.endsAt),
      lastDays: isLastDays(a, now),
      url: `${MUESTRAS_URL}/m/${encodeURIComponent(a.slug)}`,
    })),
    verTodasUrl: origen ? `${MUESTRAS_URL}${nearHref(origen.coords, lugar)}` : `${MUESTRAS_URL}/#muestras`,
  };
}
