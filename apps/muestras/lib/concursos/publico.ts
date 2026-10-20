import "server-only";
import { prisma } from "@repo/db";
import { workAccess } from "@repo/muestras";
import { estadoPublicoDelConcurso } from "./fotorank";

/**
 * Lo público de una muestra armada desde un concurso de FotoRank (etapa 7, D13, D23, D24). Todo por
 * `activityWorkId`, como los datos del expositor. Una muestra sin concurso no cambia: estas lecturas
 * devuelven vacío, y ante cualquier error (por ejemplo, la migración todavía sin aplicar) también,
 * para no tumbar una página pública.
 */
const FOTORANK_POR_OMISION = "https://fotorank.dnxsuite.com";

function avisar(que: string, err: unknown) {
  console.error(`[muestras] ${que}:`, err instanceof Error ? err.message : String(err));
}

/** "1.er premio · Paisaje — <Concurso>" por obra de la muestra; sólo las que siguen en la muestra. */
export async function distinctionsForWorks(activityId: string, workIds: readonly string[]): Promise<Map<string, string>> {
  if (workIds.length === 0) return new Map();
  try {
    const filas = await prisma.culturalContestWork.findMany({
      where: { activityId, include: true, activityWorkId: { in: [...workIds] } },
      select: { activityWorkId: true, distinction: true, import: { select: { contestTitle: true } } },
    });
    return new Map(
      filas.flatMap((f) => {
        const premio = f.distinction.trim();
        if (!f.activityWorkId || !premio) return [];
        const concurso = f.import.contestTitle.trim();
        return [[f.activityWorkId, concurso ? `${premio} — ${concurso}` : premio] as const];
      }),
    );
  } catch (err) {
    avisar("premios del concurso", err);
    return new Map();
  }
}

/** Las obras del concurso que están en la muestra pero no se imprimen ("sólo online", D13). */
export async function obrasSoloOnline(activityId: string): Promise<Set<string>> {
  try {
    const filas = await prisma.culturalContestWork.findMany({
      where: { activityId, toPrint: false, activityWorkId: { not: null } },
      select: { activityWorkId: true },
    });
    return new Set(filas.flatMap((f) => (f.activityWorkId ? [f.activityWorkId] : [])));
  } catch (err) {
    avisar("obras sólo online", err);
    return new Set();
  }
}

export function fotorankBaseUrl(): string {
  return (process.env.FOTORANK_PUBLIC_BASE_URL?.trim() || FOTORANK_POR_OMISION).replace(/\/+$/, "");
}

/**
 * "Muestra del concurso <título>" (D24): el título guardado al armar y el enlace a FotoRank sólo si
 * la página pública del concurso está abierta. `null` si la muestra no salió de un concurso.
 */
export async function concursoDeMuestra(activityId: string): Promise<{ title: string; url: string | null } | null> {
  try {
    const imp = await prisma.culturalContestImport.findUnique({ where: { activityId }, select: { contestId: true, contestTitle: true } });
    if (!imp) return null;
    const pub = await estadoPublicoDelConcurso(imp.contestId);
    return { title: imp.contestTitle, url: pub ? `${fotorankBaseUrl()}/concursos/${encodeURIComponent(pub.slug)}` : null };
  } catch (err) {
    avisar("concurso de la muestra", err);
    return null;
  }
}

/**
 * El premio en la página pública de la obra (D23): sólo si la obra se ve con su imagen según la
 * sorpresa de la muestra (`workAccess` = "FULL"). Una obra reservada para la sala no muestra nada.
 */
export function premioVisible<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: Parameters<typeof workAccess<W>>[0],
  works: W[],
  workId: string,
  ahora: Date,
  premios: ReadonlyMap<string, string>,
): string | null {
  if (workAccess(a, works, workId, ahora) !== "FULL") return null;
  return premios.get(workId) ?? null;
}
