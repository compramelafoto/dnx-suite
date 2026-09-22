"use server";

import { revalidatePath } from "next/cache";
import { getClickatonJuryPrisma } from "@repo/db/clickaton-jury-client";
import { getJuryDirectoryPrisma } from "@repo/db/jury-directory-client";

import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";

import {
  SIN_CONEXION_AL_PADRON,
  SIN_CONEXION_A_CLICKATON,
  NO_SE_PUEDE_QUITAR,
  sePuedeQuitar,
} from "./assign-judge";
import {
  asignarJuradoAMaraton,
  type MaratonPrisma,
  type PadronPrisma,
} from "./service";

export type ResultadoDeLaPantalla = { ok: boolean; mensaje: string };

/**
 * La base de la maratón.
 *
 * Es la propia de Clickatón, pero se usa el cliente con escritura acotada al
 * circuito de jurado en vez del cliente de administración: así la conexión que
 * el portal de FotoRank necesita y la que usa esta pantalla son la misma, y si
 * falta configurarla se nota acá y no cuando un jurado intenta votar.
 */
function conexiones(): { padron: PadronPrisma | null; maraton: MaratonPrisma | null } {
  return {
    padron: getJuryDirectoryPrisma() as unknown as PadronPrisma | null,
    maraton: getClickatonJuryPrisma() as unknown as MaratonPrisma | null,
  };
}

function refrescar(editionId: string) {
  revalidatePath(`${adminRoutes.editions}/${editionId}/jurados`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/admision`);
}

export async function asignarJuradoAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  const user = await requireClickatonAdmin();

  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { fotorankContestId: true },
  });
  if (!edicion?.fotorankContestId) {
    return {
      ok: false,
      mensaje: "Esta edición todavía no tiene su concurso creado. No se puede asignar jurado.",
    };
  }

  const { padron, maraton } = conexiones();
  if (!padron) return { ok: false, mensaje: SIN_CONEXION_AL_PADRON };
  if (!maraton) return { ok: false, mensaje: SIN_CONEXION_A_CLICKATON };

  const judgeAccountId = String(formData.get("judgeAccountId") ?? "").trim();
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  // La organización sale del concurso, no del formulario: si viniera de afuera,
  // se podrían colgar asignaciones de una organización ajena.
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: edicion.fotorankContestId },
    select: { organizationId: true },
  });
  if (!contest) {
    return { ok: false, mensaje: "No encontramos el concurso de esta edición." };
  }

  const r = await asignarJuradoAMaraton({
    padron,
    maraton,
    judgeAccountId,
    organizationId: contest.organizationId,
    contestId: edicion.fotorankContestId,
    categoryIds,
    createdByUserId: user.id,
    methodType: "SCORE_1_10",
  });

  if (!r.ok) {
    return {
      ok: false,
      mensaje:
        r.error === "SIN_PADRON"
          ? SIN_CONEXION_AL_PADRON
          : r.error === "SIN_MARATON"
            ? SIN_CONEXION_A_CLICKATON
            : r.error,
    };
  }

  refrescar(editionId);

  if (r.creadas === 0) {
    return { ok: true, mensaje: "Ese jurado ya estaba asignado a esas categorías." };
  }
  const cuantas = r.creadas === 1 ? "1 categoría" : `${r.creadas} categorías`;
  const repetidas = r.yaEstaban > 0 ? ` (${r.yaEstaban} ya estaban)` : "";
  return { ok: true, mensaje: `Jurado asignado a ${cuantas}${repetidas}.` };
}

export async function quitarAsignacionAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  await requireClickatonAdmin();

  const { maraton } = conexiones();
  if (!maraton) return { ok: false, mensaje: SIN_CONEXION_A_CLICKATON };

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!assignmentId) return { ok: false, mensaje: "Falta indicar la asignación." };

  const db = maraton as unknown as {
    fotorankJudgeAssignment: {
      findUnique(args: {
        where: { id: string };
        select: Record<string, unknown>;
      }): Promise<{ id: string; _count: { votes: number } } | null>;
      delete(args: { where: { id: string } }): Promise<unknown>;
    };
  };

  const asignacion = await db.fotorankJudgeAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, _count: { select: { votes: true } } },
  });
  if (!asignacion) return { ok: false, mensaje: "Esa asignación ya no existe." };

  if (!sePuedeQuitar({ votos: asignacion._count.votes })) {
    return { ok: false, mensaje: NO_SE_PUEDE_QUITAR };
  }

  await db.fotorankJudgeAssignment.delete({ where: { id: assignmentId } });
  refrescar(editionId);
  return { ok: true, mensaje: "Asignación quitada." };
}
