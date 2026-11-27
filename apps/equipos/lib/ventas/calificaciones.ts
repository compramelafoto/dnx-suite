import { prisma } from "@repo/db";
import { EquipoError } from "@/lib/inventario/equipos";
import { MENSAJE_CUENTA_SUSPENDIDA, isBlocked } from "@/lib/usuarios/bloqueo";
import { VentaError, getSaleForParty } from "./ventas";
import type { UserRating } from "./formato-calificacion";

export { formatRating, type UserRating } from "./formato-calificacion";

/**
 * Calificaciones entre comprador y vendedor. Sólo las partes de una venta confirmada, una vez
 * cada una y dentro de los 30 días de la confirmación.
 */

export const RATING_WINDOW_DAYS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_COMENTARIO = 300;

const SIN_CALIFICAR: UserRating = { average: null, count: 0 };

const redondear = (n: number): number => Math.round(n * 10) / 10;

export async function getUserRatings(userIds: number[]): Promise<Map<number, UserRating>> {
  const ids = [...new Set(userIds)];
  const out = new Map<number, UserRating>();
  if (ids.length === 0) return out;
  const rows = await prisma.gearSaleRating.groupBy({
    by: ["ratedId"],
    where: { ratedId: { in: ids } },
    orderBy: { ratedId: "asc" },
    _avg: { score: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    out.set(r.ratedId, {
      average: r._avg.score == null ? null : redondear(r._avg.score),
      count: r._count._all,
    });
  }
  for (const id of ids) if (!out.has(id)) out.set(id, { ...SIN_CALIFICAR });
  return out;
}

export async function getUserRating(userId: number): Promise<UserRating> {
  return (await getUserRatings([userId])).get(userId) ?? { ...SIN_CALIFICAR };
}

export async function rateSale(
  raterId: number,
  saleId: number,
  score: number,
  comment?: string,
): Promise<void> {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new EquipoError("DATO_INVALIDO", "La calificación va de 1 a 5 estrellas.");
  }
  const texto = comment?.trim() || null;
  if (texto && texto.length > MAX_COMENTARIO) {
    throw new EquipoError("DATO_INVALIDO", `El comentario puede tener hasta ${MAX_COMENTARIO} caracteres.`);
  }

  if (await isBlocked(raterId)) throw new EquipoError("DATO_INVALIDO", MENSAJE_CUENTA_SUSPENDIDA);
  const sale = await getSaleForParty(raterId, saleId);
  if (!sale) throw new VentaError("NO_ENCONTRADA");
  if (sale.status !== "CONFIRMED" || !sale.resolvedAt) throw new VentaError("NO_PENDIENTE");
  if (Date.now() - sale.resolvedAt.getTime() > RATING_WINDOW_DAYS * DIA_MS) {
    throw new VentaError("NO_PENDIENTE");
  }

  const ratedId = sale.buyerId === raterId ? sale.sellerId : sale.buyerId;
  try {
    await prisma.gearSaleRating.create({
      data: { saleId, raterId, ratedId, score, comment: texto },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      throw new EquipoError("DATO_INVALIDO", "Ya calificaste esta operación.");
    }
    throw err;
  }
}

/** Si esta persona ya calificó esta venta (una calificación por parte y por venta). */
export async function hasRated(raterId: number, saleId: number): Promise<boolean> {
  const row = await prisma.gearSaleRating.findUnique({
    where: { saleId_raterId: { saleId, raterId } },
    select: { id: true },
  });
  return row !== null;
}

export type RatingAboutMe = { id: number; score: number; comment: string; createdAt: Date; de: string };

/** Calificaciones recibidas que traen comentario, las más nuevas primero. `de` es el nombre de pila. */
export async function listRatingsAbout(userId: number): Promise<RatingAboutMe[]> {
  const rows = (await prisma.gearSaleRating.findMany({
    where: { ratedId: userId, comment: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, score: true, comment: true, createdAt: true, rater: { select: { name: true } } },
  })) as Array<{
    id: number;
    score: number;
    comment: string | null;
    createdAt: Date;
    rater: { name: string | null };
  }>;
  return rows.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment ?? "",
    createdAt: r.createdAt,
    de: nombreDePila(r.rater.name),
  }));
}

function nombreDePila(name: string | null): string {
  const palabra = name?.trim().split(/\s+/)[0];
  if (!palabra) return "Usuario";
  return palabra.charAt(0).toLocaleUpperCase("es-AR") + palabra.slice(1);
}
