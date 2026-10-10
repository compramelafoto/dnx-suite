import "server-only";
import { prisma } from "@repo/db";
import { conPermiso, dondePuede } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/**
 * Lecturas del panel para el concurso de FotoRank en la muestra (etapa 7). El permiso va siempre en
 * el `where` (`dondePuede`/`conPermiso`): nunca "leer y después mirar".
 */
type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/**
 * Las muestras propias a las que se pueden sumar obras de un concurso (D8): tipo muestra, editables
 * (borrador, rechazada o publicada; no en revisión ni despublicada) y sin obras de ningún concurso.
 * El super admin ve sólo las suyas, como en los listados del panel.
 */
export async function muestrasParaSumar(usuario: Quien) {
  return prisma.culturalActivity.findMany({
    where: conPermiso(
      { type: "MUESTRA", reviewStatus: { in: ["DRAFT", "REJECTED", "APPROVED"] }, isCancelled: false, contestImport: { is: null } },
      usuario,
      "contest",
      { listado: true },
    ),
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, reviewStatus: true },
  });
}

/** Las muestras que ya salieron de este concurso y esta persona puede ver. */
export async function muestrasDeEsteConcurso(usuario: Quien, contestId: string) {
  const filas = await prisma.culturalContestImport.findMany({
    where: { contestId, activity: dondePuede(usuario, "view") },
    orderBy: { createdAt: "desc" },
    select: { activity: { select: { id: true, title: true, reviewStatus: true } } },
  });
  return filas.map((f) => f.activity);
}
