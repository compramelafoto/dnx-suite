import "server-only";
import { prisma } from "@repo/db";

/**
 * Una sola importación CSV a la vez por organización (clientes o consultas): dos corridas
 * simultáneas del mismo archivo (dos pestañas, un doble clic) podrían duplicar filas, porque
 * cada una controla los duplicados contra lo que había al empezar.
 *
 * Una importación dura minutos y hace muchas transacciones, así que el candado no puede ser un
 * `pg_advisory_xact_lock` (dura una transacción) ni uno de sesión (con el pool de conexiones no
 * se sabe en qué conexión queda). Es una fila "en curso" en `FotofficeListActivity`
 * (`listKey: "importacion"`, `kind: "IMPORT_LOCK"`), sin columnas ni tablas nuevas:
 * - se toma en una transacción corta, con un `pg_advisory_xact_lock` por organización que pone
 *   en fila a dos que llegan juntas: la segunda ve la fila de la primera y no entra;
 * - vence a los 10 minutos (una corrida que murió no deja la organización trabada: la importación
 *   tiene `maxDuration` de 300 s);
 * - se borra al terminar, salga bien o mal.
 */

export const MENSAJE_IMPORTACION_EN_CURSO = "Ya hay una importación en curso; probá en unos minutos.";
export const LISTA_BLOQUEO = "importacion";
export const TIPO_BLOQUEO = "IMPORT_LOCK";
export const VIGENCIA_BLOQUEO_MS = 10 * 60_000;

export type QuienImporta = { workspaceId: string; userId: number | null; userLabel: string };

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[importacion] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** Corre `fn` con el candado de importación del workspace; si otra está en curso, no la corre. */
export async function conBloqueoDeImportacion<T>(
  quien: QuienImporta,
  que: "clientes" | "consultas",
  fn: () => Promise<T>,
  ahora: () => Date = () => new Date(),
): Promise<{ ok: true; valor: T } | { ok: false; error: string }> {
  const { workspaceId } = quien;
  const tomado = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-importacion:${workspaceId}`}))`;
    const desde = new Date(ahora().getTime() - VIGENCIA_BLOQUEO_MS);
    const vigente = await tx.fotofficeListActivity.findFirst({
      where: { workspaceId, listKey: LISTA_BLOQUEO, kind: TIPO_BLOQUEO, createdAt: { gt: desde } },
      select: { id: true },
    });
    if (vigente) return null;
    // Los vencidos (de una corrida que murió) se limpian antes de tomar el nuevo.
    await tx.fotofficeListActivity.deleteMany({ where: { workspaceId, listKey: LISTA_BLOQUEO, kind: TIPO_BLOQUEO } });
    const fila = await tx.fotofficeListActivity.create({
      data: {
        workspaceId, listKey: LISTA_BLOQUEO, kind: TIPO_BLOQUEO, action: que, actorUserId: quien.userId,
        actorLabel: quien.userLabel, rowCount: 0, query: "", createdAt: ahora(),
      },
      select: { id: true },
    });
    return fila.id;
  });
  if (!tomado) return { ok: false, error: MENSAJE_IMPORTACION_EN_CURSO };
  try {
    return { ok: true, valor: await fn() };
  } finally {
    try {
      await prisma.fotofficeListActivity.deleteMany({ where: { id: tomado, workspaceId } });
    } catch (error) {
      // Si no se pudo soltar, vence solo a los 10 minutos.
      registrarFalla("soltar el candado", error);
    }
  }
}
