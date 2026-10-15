/**
 * Enlaces entre FotoRank y Muestras Fotográficas (etapa 7 de Muestras). Misma base: FotoRank sólo LEE
 * las muestras publicadas que salieron de un concurso. Nunca rompe una página: ante cualquier error
 * (por ejemplo, la migración de Muestras todavía no aplicada) devuelve una lista vacía.
 */
import { prisma } from "@repo/db";

const MUESTRAS_POR_OMISION = "https://muestrasfotograficas.com";

export function muestrasBaseUrl(): string {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- optativa, de runtime
  return (process.env.MUESTRAS_PUBLIC_BASE_URL?.trim() || MUESTRAS_POR_OMISION).replace(/\/+$/, "");
}

export function armarMuestraUrl(contestId: string): string {
  return `${muestrasBaseUrl()}/panel/concursos/${encodeURIComponent(contestId)}`;
}

export type MuestraDelConcurso = { title: string; url: string; venue: string | null; city: string | null; startsAt: Date; endsAt: Date };

type Db = {
  culturalContestImport: {
    findMany: (args: unknown) => Promise<Array<{ activity: { slug: string; title: string; venueName: string | null; city: string | null; startsAt: Date; endsAt: Date } }>>;
  };
};

export async function muestrasDelConcurso(contestId: string, db: Db = prisma as unknown as Db): Promise<MuestraDelConcurso[]> {
  try {
    const filas = await db.culturalContestImport.findMany({
      where: { contestId, activity: { reviewStatus: "APPROVED", isCancelled: false, type: "MUESTRA" } },
      select: { activity: { select: { slug: true, title: true, venueName: true, city: true, startsAt: true, endsAt: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    return filas.map(({ activity: a }) => ({
      title: a.title,
      url: `${muestrasBaseUrl()}/m/${encodeURIComponent(a.slug)}`,
      venue: a.venueName,
      city: a.city,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    }));
  } catch (err) {
    console.error("[fotorank] muestras del concurso:", err instanceof Error ? err.message : String(err));
    return [];
  }
}
