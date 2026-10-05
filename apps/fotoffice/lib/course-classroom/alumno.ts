// lib/course-classroom/alumno.ts
import "server-only";
import { prisma } from "@repo/db";
import { otorgarAccesoPorCompra } from "./grant";

/**
 * La persona como alumna: si tiene cursos y qué le falta otorgar.
 *
 * "Tener cursos" cuenta también una inscripción aprobada a un grabado que todavía no tiene su
 * acceso (porque algo falló después del pago): así esa persona igual entra al portal, y Mis
 * cursos se lo repara.
 */

async function correoDe(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

export async function tieneCursos(userId: number): Promise<boolean> {
  const accesos = await prisma.courseAccess.count({ where: { userId } });
  if (accesos > 0) return true;
  const email = await correoDe(userId);
  if (!email) return false;
  const pendientes = await prisma.courseEnrollment.count({
    where: {
      email: { equals: email, mode: "insensitive" },
      paymentStatus: "APPROVED",
      course: { deliveryMode: "RECORDED" },
    },
  });
  return pendientes > 0;
}

export type PendientesDeps = {
  buscarPendientes: (userId: number) => Promise<string[]>;
  otorgar: (input: { enrollmentId: string; userId: number }) => Promise<unknown>;
};

function pendientesDepsPorDefecto(): PendientesDeps {
  return {
    buscarPendientes: async (userId) => {
      const email = await correoDe(userId);
      if (!email) return [];
      const filas = await prisma.courseEnrollment.findMany({
        where: {
          email: { equals: email, mode: "insensitive" },
          paymentStatus: "APPROVED",
          course: { deliveryMode: "RECORDED", accesses: { none: { userId } } },
          access: { is: null },
          // Una inscripción de beneficio nunca queda pendiente: se otorga en el mismo acto.
          paymentMethod: "MERCADO_PAGO",
        },
        select: { id: true },
      });
      return filas.map((f) => f.id);
    },
    otorgar: (input) => otorgarAccesoPorCompra(input),
  };
}

/** Devuelve cuántos otorgó. Nunca lanza por una inscripción: sigue con la siguiente. */
export async function otorgarAccesosPendientes(
  userId: number,
  deps: PendientesDeps = pendientesDepsPorDefecto(),
): Promise<number> {
  const pendientes = await deps.buscarPendientes(userId);
  let otorgados = 0;
  for (const enrollmentId of pendientes) {
    try {
      await deps.otorgar({ enrollmentId, userId });
      otorgados++;
    } catch (error) {
      console.error("[fotoffice][cursos] no se pudo otorgar un acceso pendiente", {
        enrollmentId,
        motivo: error instanceof Error ? error.message : "desconocido",
      });
    }
  }
  return otorgados;
}
