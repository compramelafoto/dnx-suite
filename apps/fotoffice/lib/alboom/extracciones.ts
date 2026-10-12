import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { avanceInicial, leerAvance, type Avance } from "./avance";

/**
 * Ciclo de vida de `FotofficeAlboomExtraccion`. Toda consulta lleva `workspaceId`.
 *
 * Una sola extracción activa (PENDIENTE o CORRIENDO) por workspace: lo controla el código y, si dos pedidos se
 * cruzan, el índice único parcial de la base. Dos tandas del cron no corren la misma extracción a la vez:
 * `reclamarExtraccion` toma un "turno" (`lockedUntil`) con una escritura condicional.
 */

export const ESTADOS_ACTIVOS = ["PENDIENTE", "CORRIENDO"] as const;
export type EstadoExtraccion = "PENDIENTE" | "CORRIENDO" | "LISTA" | "ERROR" | "CANCELADA";
export type ModoExtraccion = "TODO" | "INCREMENTAL";

export type ExtraccionVista = {
  id: string;
  status: EstadoExtraccion;
  mode: ModoExtraccion;
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
  errorReason: string | null;
  avance: Avance;
};

const activa = { in: [...ESTADOS_ACTIVOS] };

function esUnicoRepetido(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export async function hayExtraccionActiva(workspaceId: string): Promise<boolean> {
  const fila = await prisma.fotofficeAlboomExtraccion.findFirst({ where: { workspaceId, status: activa }, select: { id: true } });
  return fila !== null;
}

/**
 * ¿Hay una tanda que todavía puede estar escribiendo? Una extracción recién cancelada conserva su turno
 * (`lockedUntil`) hasta que la tanda que la corría lo nota y lo suelta (o vence). Mientras tanto no se borra ni se
 * arranca otra: así "Cancelar" y enseguida "Borrar" no dejan filas sueltas, y no hay dos tandas a la vez.
 */
async function tandaEnVuelo(workspaceId: string, ahora: Date): Promise<boolean> {
  const fila = await prisma.fotofficeAlboomExtraccion.findFirst({ where: { workspaceId, lockedUntil: { gt: ahora } }, select: { id: true } });
  return fila !== null;
}

const ESPERAR_TANDA = "La última tanda todavía está terminando. Probá de nuevo en unos minutos.";

/** "Extraer todo" (TODO) o "Volver a extraer" (INCREMENTAL). La corre el cron en tandas. */
export async function iniciarExtraccion(
  workspaceId: string,
  userId: number,
  mode: ModoExtraccion,
  ahora = new Date(),
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (await hayExtraccionActiva(workspaceId)) return { ok: false, error: "Ya hay una extracción en curso." };
  if (await tandaEnVuelo(workspaceId, ahora)) return { ok: false, error: ESPERAR_TANDA };
  try {
    const fila = await prisma.fotofficeAlboomExtraccion.create({
      data: { workspaceId, status: "PENDIENTE", mode, progress: avanceInicial() as unknown as Prisma.InputJsonValue, startedByUserId: userId },
      select: { id: true },
    });
    return { ok: true, id: fila.id };
  } catch (error) {
    // Otra pestaña la arrancó entre el chequeo y el alta: el índice parcial lo frenó.
    if (esUnicoRepetido(error)) return { ok: false, error: "Ya hay una extracción en curso." };
    throw error;
  }
}

/**
 * Cancela la activa, si hay. La tanda que esté corriendo lo nota al guardar su próximo avance, frena y suelta el
 * turno (`soltarCancelada`); hasta entonces el turno sigue tomado.
 */
export async function cancelarExtraccion(workspaceId: string, ahora = new Date()): Promise<boolean> {
  const r = await prisma.fotofficeAlboomExtraccion.updateMany({
    where: { workspaceId, status: activa },
    data: { status: "CANCELADA", finishedAt: ahora },
  });
  return r.count > 0;
}

/** "Borrar lo extraído": los datos crudos y el historial de extracciones. No con una extracción en curso. */
export async function borrarLoExtraido(
  workspaceId: string,
  ahora = new Date(),
): Promise<{ ok: true; registros: number } | { ok: false; error: string }> {
  if (await hayExtraccionActiva(workspaceId)) return { ok: false, error: "Hay una extracción en curso: cancelala antes de borrar." };
  if (await tandaEnVuelo(workspaceId, ahora)) return { ok: false, error: ESPERAR_TANDA };
  const crudos = await prisma.fotofficeAlboomCrudo.deleteMany({ where: { workspaceId } });
  await prisma.fotofficeAlboomExtraccion.deleteMany({ where: { workspaceId, status: { notIn: [...ESTADOS_ACTIVOS] } } });
  return { ok: true, registros: crudos.count };
}

export async function ultimaExtraccion(workspaceId: string): Promise<ExtraccionVista | null> {
  const f = await prisma.fotofficeAlboomExtraccion.findFirst({
    where: { workspaceId },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, mode: true, startedAt: true, finishedAt: true, updatedAt: true, errorReason: true, progress: true },
  });
  if (!f) return null;
  return {
    id: f.id,
    status: f.status as EstadoExtraccion,
    mode: f.mode as ModoExtraccion,
    startedAt: f.startedAt,
    finishedAt: f.finishedAt,
    updatedAt: f.updatedAt,
    errorReason: f.errorReason,
    avance: leerAvance(f.progress),
  };
}

// ── Para el cron ─────────────────────────────────────────────────────────────

function libre(ahora: Date) {
  return [{ lockedUntil: null }, { lockedUntil: { lt: ahora } }];
}

/** Activas que nadie está corriendo, las más demoradas primero. Recorre todos los workspaces a propósito. */
export async function extraccionesParaCorrer(ahora: Date, limite = 20): Promise<{ id: string; workspaceId: string }[]> {
  return prisma.fotofficeAlboomExtraccion.findMany({
    where: { status: activa, OR: libre(ahora) },
    orderBy: { updatedAt: "asc" },
    take: limite,
    select: { id: true, workspaceId: true },
  });
}

/** Toma el turno de una extracción (la pasa a CORRIENDO). `false` si otra tanda la tiene o ya no está activa. */
export async function reclamarExtraccion(id: string, workspaceId: string, ahora: Date, turnoMs: number): Promise<boolean> {
  const r = await prisma.fotofficeAlboomExtraccion.updateMany({
    where: { id, workspaceId, status: activa, OR: libre(ahora) },
    data: { status: "CORRIENDO", lockedUntil: new Date(ahora.getTime() + turnoMs) },
  });
  return r.count === 1;
}

export async function leerAvanceDe(id: string, workspaceId: string): Promise<Avance | null> {
  const f = await prisma.fotofficeAlboomExtraccion.findFirst({ where: { id, workspaceId }, select: { progress: true } });
  return f ? leerAvance(f.progress) : null;
}

/** Guarda el avance. `false` si la extracción ya no está CORRIENDO (la cancelaron): el extractor frena. */
export async function guardarAvance(id: string, workspaceId: string, avance: Avance): Promise<boolean> {
  const r = await prisma.fotofficeAlboomExtraccion.updateMany({
    where: { id, workspaceId, status: "CORRIENDO" },
    data: { progress: avance as unknown as Prisma.InputJsonValue },
  });
  return r.count === 1;
}

/** La tanda notó la cancelación: suelta el turno para que se pueda borrar o volver a extraer. */
export async function soltarCancelada(id: string, workspaceId: string): Promise<void> {
  await prisma.fotofficeAlboomExtraccion.updateMany({ where: { id, workspaceId, status: "CANCELADA" }, data: { lockedUntil: null } });
}

/** Suelta el turno sin terminar (pausa por tiempo o espera por 429/5xx). */
export async function soltarExtraccion(id: string, workspaceId: string, avance: Avance): Promise<void> {
  await prisma.fotofficeAlboomExtraccion.updateMany({
    where: { id, workspaceId, status: "CORRIENDO" },
    data: { progress: avance as unknown as Prisma.InputJsonValue, lockedUntil: null },
  });
}

export async function terminarExtraccion(
  id: string,
  workspaceId: string,
  status: "LISTA" | "ERROR",
  avance: Avance | null,
  errorReason: string | null,
  ahora: Date,
): Promise<void> {
  await prisma.fotofficeAlboomExtraccion.updateMany({
    where: { id, workspaceId, status: activa },
    data: {
      status,
      finishedAt: ahora,
      lockedUntil: null,
      errorReason: errorReason ? errorReason.slice(0, 500) : null,
      ...(avance ? { progress: avance as unknown as Prisma.InputJsonValue } : {}),
    },
  });
}
