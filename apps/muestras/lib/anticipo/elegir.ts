import "server-only";
import { prisma } from "@repo/db";
import { pickPerVisit, visibleWorks } from "@repo/muestras";
import { esUrlWeb } from "@/lib/url";

export type ObraDelAnticipo = { id: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null };

/**
 * "Cambian para cada visitante" (spec D23): N obras expuestas elegidas **en el servidor, en cada
 * pedido**, con el azar que pasa quien llama (`crypto.randomInt`). Sólo viajan esas N y sólo los
 * campos de la galería. `null` si la muestra no existe, no está publicada o su ajuste hoy no es "para
 * cada visitante" (fijo, ninguna, cerrada y revelada…): ahí la página ya trae lo que corresponde.
 */
export async function obrasDelAnticipo(slug: string, randomInt: (max: number) => number): Promise<ObraDelAnticipo[] | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: { slug, reviewStatus: "APPROVED", type: "MUESTRA" },
    select: {
      galleryMode: true, visibility: true, startsAt: true, endsAt: true,
      works: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, imageUrl: true, title: true, authorName: true, year: true, technique: true, isHighlight: true, sortOrder: true },
      },
    },
  });
  if (!a) return null;
  const g = visibleWorks(a, a.works, new Date());
  if (!g.perVisit) return null;
  const con = a.works.filter((w) => esUrlWeb(w.imageUrl));
  return pickPerVisit(con, g.perVisit.count, randomInt).map(({ id, imageUrl, title, authorName, year, technique }) => ({
    id, imageUrl, title, authorName, year, technique,
  }));
}

/**
 * Para la respuesta frenada (spec D23): los ids de las obras expuestas si **hoy** la muestra sigue
 * publicada y en "para cada visitante"; si no, `null`. Así, si quien organiza pasó a "Sorpresa total"
 * (o sacó una obra), lo que quedó en memoria no se repite. Sin las imágenes: sólo lo que pide la regla.
 */
export async function obrasDelAnticipoVigente(slug: string): Promise<Set<string> | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: { slug, reviewStatus: "APPROVED", type: "MUESTRA" },
    select: {
      galleryMode: true, visibility: true, startsAt: true, endsAt: true,
      works: { select: { id: true, isHighlight: true, sortOrder: true } },
    },
  });
  if (!a || !visibleWorks(a, a.works, new Date()).perVisit) return null;
  return new Set(a.works.map((w) => w.id));
}
