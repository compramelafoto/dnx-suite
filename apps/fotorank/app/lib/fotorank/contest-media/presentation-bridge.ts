/**
 * Puente entre las imágenes cargadas desde el administrador y el sistema visual
 * que ya usaban la landing y el listado.
 *
 * Se mantiene aparte del resolvedor visual a propósito: `contest-visual` no
 * consulta la base, y no queremos que empiece a hacerlo. Acá se leen las filas
 * y se entregan en la forma que ese módulo ya entiende
 * (`PresentationRuntimeOverride.managed`).
 */

import { prisma } from "@repo/db";
import type { ManagedContestMedia } from "../contest-visual/resolve-presentation";
import { contestMediaAbsoluteUrl, contestMediaUrl } from "./public-url";
import type { ContestMediaKind } from "./specs";

export type ManagedMediaBundle = {
  banner?: ManagedContestMedia | null;
  card?: ManagedContestMedia | null;
  social?: ManagedContestMedia | null;
};

/**
 * Imágenes vigentes de un concurso, listas para el resolvedor visual.
 *
 * `absolute` existe por Open Graph: WhatsApp y las redes no resuelven rutas
 * relativas, necesitan la URL completa.
 */
export async function resolveManagedContestMedia(
  contestId: string,
  options?: { absolute?: boolean },
): Promise<ManagedMediaBundle> {
  const rows = await prisma.fotorankContestMediaAsset.findMany({
    where: { contestId, isActive: true, deletedAt: null },
    select: {
      id: true,
      kind: true,
      altText: true,
      focalPointX: true,
      focalPointY: true,
    },
  });

  const bundle: ManagedMediaBundle = {};
  for (const row of rows) {
    const media: ManagedContestMedia = {
      url: options?.absolute
        ? contestMediaAbsoluteUrl(contestId, row.id)
        : contestMediaUrl(contestId, row.id),
      alt: row.altText,
      focalPointX: row.focalPointX,
      focalPointY: row.focalPointY,
    };
    bundle[kindToSlot(row.kind as ContestMediaKind)] = media;
  }

  /**
   * Respaldo entre tipos: si falta la de compartir se usa el banner, y si falta
   * la de tarjeta también. Evita obligar a subir tres veces la misma pieza y
   * evita que un concurso con banner cargado aparezca sin imagen al compartirlo.
   */
  bundle.card = bundle.card ?? bundle.banner ?? null;
  bundle.social = bundle.social ?? bundle.banner ?? null;

  return bundle;
}

/**
 * Versión para varios concursos a la vez.
 * El listado muestra hasta seis convocatorias; una consulta para todas en lugar
 * de una por concurso.
 */
export async function resolveManagedContestMediaBatch(
  contestIds: string[],
): Promise<Map<string, ManagedMediaBundle>> {
  const out = new Map<string, ManagedMediaBundle>();
  if (contestIds.length === 0) return out;

  const rows = await prisma.fotorankContestMediaAsset.findMany({
    where: { contestId: { in: contestIds }, isActive: true, deletedAt: null },
    select: {
      id: true,
      contestId: true,
      kind: true,
      altText: true,
      focalPointX: true,
      focalPointY: true,
    },
  });

  for (const row of rows) {
    const bundle = out.get(row.contestId) ?? {};
    bundle[kindToSlot(row.kind as ContestMediaKind)] = {
      url: contestMediaUrl(row.contestId, row.id),
      alt: row.altText,
      focalPointX: row.focalPointX,
      focalPointY: row.focalPointY,
    };
    out.set(row.contestId, bundle);
  }

  for (const bundle of out.values()) {
    bundle.card = bundle.card ?? bundle.banner ?? null;
    bundle.social = bundle.social ?? bundle.banner ?? null;
  }

  return out;
}

function kindToSlot(kind: ContestMediaKind): keyof ManagedMediaBundle {
  if (kind === "BANNER") return "banner";
  if (kind === "CARD") return "card";
  return "social";
}
