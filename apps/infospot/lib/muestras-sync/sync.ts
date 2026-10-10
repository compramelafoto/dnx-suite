/**
 * Sync Muestras Fotográficas → Info Spot.
 *
 * Lee la lista pública de muestrasfotograficas.com y, por cada actividad con lugar en el mapa:
 * - si no existe, crea el evento ya PUBLICADO (las aprobó Daniel o su institución en Muestras);
 * - si existe, actualiza fechas, lugar y textos, respetando lo que la redacción editó a mano;
 * - si dejó de venir (cerró, se canceló o se despublicó), lo retira (UNPUBLISHED).
 *
 * Nunca vuelve a publicar un evento que la redacción despublicó: sólo los que retiró esta sync.
 */

import { prisma } from "@repo/db";
import { slugifyTitle } from "../slug";
import { linkEventToOrigin, markOriginFailed, markOriginStale, markOriginSynced } from "../content-origin";
import { encodeGeohash } from "../geolocation";
import { revalidateEventPaths } from "../event-revalidate";
import {
  MUESTRAS_CATEGORY_SLUG,
  MUESTRAS_EXTERNAL_PREFIX,
  MUESTRAS_FEED_URL,
  buildMuestraUpdate,
  isMuestraImportable,
  normalizeMuestra,
  parseMuestrasFeed,
  type MuestraFeedItem,
} from "./normalize";

export type MuestrasSyncSummary = {
  dryRun: boolean;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  republished: number;
  withdrawn: number;
  skipped: number;
  failed: number;
  errors: string[];
};

const ORIGEN = { sourceType: "API", externalEntityType: "EVENT" } as const;

export async function fetchMuestrasFeed(fetchImpl: typeof fetch = fetch): Promise<MuestraFeedItem[]> {
  const res = await fetchImpl(MUESTRAS_FEED_URL, {
    headers: { Accept: "application/json", "User-Agent": "InfoSpot/1.0 (dnx-suite; muestras-sync)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Muestras respondió ${res.status}`);
  return parseMuestrasFeed(await res.json());
}

async function slugUnico(base: string): Promise<string> {
  const slug = slugifyTitle(base) || "muestra";
  for (let n = 0; n <= 50; n += 1) {
    const candidato = n === 0 ? slug : `${slug}-${n}`;
    const existe = await prisma.infoSpotEvent.findUnique({ where: { slug: candidato }, select: { id: true } });
    if (!existe) return candidato;
  }
  return `${slug}-${Date.now()}`;
}

/** Los orígenes de Muestras ya vinculados, por `externalId`. */
async function origenesVinculados() {
  const filas = await prisma.infoSpotContentOrigin.findMany({
    where: { ...ORIGEN, contentType: "EVENT", externalId: { startsWith: MUESTRAS_EXTERNAL_PREFIX }, eventId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, externalId: true, eventId: true, syncStatus: true, operationalPayload: true },
  });
  const porId = new Map<string, (typeof filas)[number]>();
  for (const f of filas) if (!porId.has(f.externalId)) porId.set(f.externalId, f);
  return porId;
}

const SELECT_EXISTENTE = {
  id: true, slug: true, status: true,
  title: true, summary: true, description: true, categoryId: true, coverImageUrl: true,
  startAt: true, endAt: true, venueName: true, city: true, province: true, address: true,
  latitude: true, longitude: true, sourceUrl: true, registrationUrl: true, organizerName: true, organizerWebsite: true,
  titleOverridden: true, descriptionOverridden: true, summaryOverridden: true, categoryOverridden: true,
  coverOverridden: true, locationOverridden: true, coordinatesOverridden: true,
} as const;

function refrescar(slug: string, id: string) {
  // Fuera de Next (CLI) no hay caché que invalidar.
  try {
    revalidateEventPaths(slug, id);
  } catch {
    /* sin contexto de Next */
  }
}

export async function reconcileMuestras(options?: { dryRun?: boolean; fetchImpl?: typeof fetch }): Promise<MuestrasSyncSummary> {
  const dryRun = options?.dryRun === true;
  const s: MuestrasSyncSummary = {
    dryRun, fetched: 0, created: 0, updated: 0, unchanged: 0, republished: 0, withdrawn: 0, skipped: 0, failed: 0, errors: [],
  };

  // Si la lista no llega o no es válida, lanza: nunca se retira nada por una falla de red.
  const items = await fetchMuestrasFeed(options?.fetchImpl);
  s.fetched = items.length;

  const vinculados = await origenesVinculados();
  const categoria = await prisma.infoSpotCategory.findUnique({ where: { slug: MUESTRAS_CATEGORY_SLUG }, select: { id: true } });
  const vigentes = new Set<string>();

  for (const item of items) {
    const externalId = `${MUESTRAS_EXTERNAL_PREFIX}${item.id}`;
    if (!isMuestraImportable(item).importable) {
      s.skipped += 1;
      continue;
    }
    vigentes.add(externalId);
    const n = normalizeMuestra(item);
    const origen = vinculados.get(externalId);

    try {
      const existente = origen?.eventId
        ? await prisma.infoSpotEvent.findUnique({ where: { id: origen.eventId }, select: SELECT_EXISTENTE })
        : null;

      if (existente && origen) {
        const { data, applied } = buildMuestraUpdate(existente, n, categoria?.id ?? null);
        if ("latitude" in data || "longitude" in data) {
          data.geohash = encodeGeohash(n.latitude, n.longitude);
        }
        // Sólo se vuelve a publicar lo que retiró esta misma sync (vuelve a estar en Muestras).
        const payload = (origen.operationalPayload ?? {}) as Record<string, unknown>;
        const republicar = existente.status === "UNPUBLISHED" && payload.withdrawnBySync === true;
        if (republicar) {
          data.status = "PUBLISHED";
          data.publishedAt = new Date();
          data.unpublishedAt = null;
        }
        const cambia = Object.keys(data).length > 0;
        if (!dryRun) {
          if (cambia) await prisma.infoSpotEvent.update({ where: { id: existente.id }, data });
          await markOriginSynced(origen.id, {
            operationalPayload: { ...n.operationalPayload, recentChanges: applied, withdrawnBySync: false },
            sourceUpdatedAt: n.sourceUpdatedAt,
          });
          if (cambia) refrescar(existente.slug, existente.id);
        }
        if (republicar) s.republished += 1;
        else if (cambia) s.updated += 1;
        else s.unchanged += 1;
        continue;
      }

      if (dryRun) {
        s.created += 1;
        continue;
      }

      const ahora = new Date();
      const creado = await prisma.infoSpotEvent.create({
        data: {
          title: n.title,
          slug: await slugUnico(n.title),
          summary: n.summary,
          description: n.description,
          categoryId: categoria?.id ?? null,
          organizerName: n.organizerName,
          organizerEmail: n.organizerEmail,
          organizerWebsite: n.organizerWebsite,
          startAt: n.startAt,
          endAt: n.endAt,
          venueName: n.venueName,
          city: n.city,
          province: n.province,
          address: n.address,
          latitude: n.latitude,
          longitude: n.longitude,
          geohash: encodeGeohash(n.latitude, n.longitude),
          locationPrecision: "COORDINATE",
          geocodingProvider: "muestras",
          geocodingStatus: "CONFIRMED",
          geocodedAt: ahora,
          locationConfirmedAt: ahora,
          // Una muestra es un lugar público: se muestra la dirección exacta.
          locationVisibility: "EXACT",
          coverImageUrl: n.coverImageUrl,
          sourceUrl: n.sourceUrl,
          registrationUrl: n.registrationUrl,
          status: "PUBLISHED",
          publishedAt: ahora,
          originKind: "SYNCED_EXTERNAL",
          contentTag: "REAL",
        },
        select: { id: true, slug: true },
      });
      const link = await linkEventToOrigin(creado.id, {
        ...ORIGEN,
        externalId,
        externalUrl: n.sourceUrl,
        direction: "INBOUND",
        syncStatus: "SYNCED",
        operationalPayload: { ...n.operationalPayload, recentChanges: ["created"] },
        sourceUpdatedAt: n.sourceUpdatedAt,
      });
      if (!link.ok) throw new Error(link.error);
      await markOriginSynced(link.origin.id, {
        operationalPayload: { ...n.operationalPayload, recentChanges: ["created"] },
        sourceUpdatedAt: n.sourceUpdatedAt,
      });
      refrescar(creado.slug, creado.id);
      s.created += 1;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      s.failed += 1;
      s.errors.push(`${externalId}: ${error}`);
      if (origen && !dryRun) await markOriginFailed(origen.id, error).catch(() => undefined);
    }
  }

  // Retiro: lo que estaba vinculado y ya no viene en la lista.
  for (const [externalId, origen] of vinculados) {
    if (vigentes.has(externalId) || !origen.eventId || origen.syncStatus === "STALE") continue;
    try {
      const ev = await prisma.infoSpotEvent.findUnique({ where: { id: origen.eventId }, select: { id: true, slug: true, status: true } });
      const retirar = ev?.status === "PUBLISHED";
      if (!dryRun) {
        if (ev && retirar) {
          await prisma.infoSpotEvent.update({ where: { id: ev.id }, data: { status: "UNPUBLISHED", unpublishedAt: new Date() } });
          refrescar(ev.slug, ev.id);
        }
        await markOriginStale(origen.id, "Ya no está publicada en Muestras Fotográficas");
        await prisma.infoSpotContentOrigin.update({
          where: { id: origen.id },
          data: { operationalPayload: { ...((origen.operationalPayload ?? {}) as object), withdrawnBySync: retirar } },
        });
      }
      if (retirar) s.withdrawn += 1;
    } catch (e) {
      s.failed += 1;
      s.errors.push(`${externalId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return s;
}
