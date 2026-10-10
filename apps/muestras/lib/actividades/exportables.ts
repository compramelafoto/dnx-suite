import { prisma } from "@repo/db";

/**
 * Lo que muestrasfotograficas.com le cuenta a otras plataformas (InfoSpot) en
 * `GET /api/public/actividades`: sólo lo que ya se ve en la página pública de cada actividad.
 * Nunca mails, teléfonos, quién la propuso ni a qué institución pertenece.
 */

export const VERSION_EXPORTABLE = 1;

/** Las que cerraron hace menos de esto siguen en la lista: InfoSpot las retira cuando dejan de venir. */
const GRACIA_MS = 24 * 60 * 60 * 1000;

export const CAMPOS_EXPORTABLES = {
  id: true, slug: true, type: true, title: true, description: true, organizersText: true, coverImageUrl: true,
  startsAt: true, endsAt: true, scheduleText: true, priceText: true, isVirtualOnly: true,
  venueName: true, address: true, city: true, province: true, latitude: true, longitude: true, updatedAt: true,
} as const;

type Fila = {
  id: string; slug: string; type: string; title: string; description: string; organizersText: string;
  coverImageUrl: string | null; startsAt: Date; endsAt: Date; scheduleText: string | null; priceText: string | null;
  isVirtualOnly: boolean; venueName: string | null; address: string | null; city: string | null; province: string | null;
  latitude: number | null; longitude: number | null; updatedAt: Date;
};

export type ActividadExportable = {
  id: string; slug: string; type: string; title: string; description: string; organizersText: string;
  coverImageUrl: string | null; startsAt: string; endsAt: string; scheduleText: string | null; priceText: string | null;
  isVirtualOnly: boolean; venueName: string | null; address: string | null; city: string | null; province: string | null;
  latitude: number | null; longitude: number | null; updatedAt: string; url: string;
};

export function aExportable(a: Fila, base: string): ActividadExportable {
  return {
    id: a.id, slug: a.slug, type: a.type, title: a.title, description: a.description, organizersText: a.organizersText,
    coverImageUrl: a.coverImageUrl, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(),
    scheduleText: a.scheduleText, priceText: a.priceText, isVirtualOnly: a.isVirtualOnly,
    venueName: a.venueName, address: a.address, city: a.city, province: a.province,
    latitude: a.latitude, longitude: a.longitude, updatedAt: a.updatedAt.toISOString(),
    url: `${base.replace(/\/+$/, "")}/m/${encodeURIComponent(a.slug)}`,
  };
}

export async function listarExportables(base: string, now = new Date()) {
  const filas = await prisma.culturalActivity.findMany({
    where: { reviewStatus: "APPROVED", isCancelled: false, endsAt: { gt: new Date(now.getTime() - GRACIA_MS) } },
    select: CAMPOS_EXPORTABLES,
    orderBy: { startsAt: "asc" },
    take: 1000,
  });
  return { v: VERSION_EXPORTABLE, generatedAt: now.toISOString(), items: filas.map((f) => aExportable(f, base)) };
}
