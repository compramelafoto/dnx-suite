import { Prisma } from "@repo/db";

/**
 * Dos reportes simultáneos para una clase sin avance previo intentan crear la misma fila y
 * uno choca con el índice único (P2002). No es un fallo: el otro reporte ya guardó el avance.
 */
export function esChoqueDeCreacion(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
