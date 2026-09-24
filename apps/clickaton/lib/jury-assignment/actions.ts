"use server";

import { revalidatePath } from "next/cache";
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
  configDelMetodo,
  esMetodoValido,
  METODO_POR_OMISION,
} from "./metodos";
import {
  asignarJuradoAMaraton,
  type MaratonPrisma,
  type PadronPrisma,
} from "./service";
import {
  armarVacantes,
  minimoDeEvaluacionesPorObra,
  repartirLoteHuerfano,
  sePuedeCambiarLaCantidad,
} from "./vacantes";

export type ResultadoDeLaPantalla = { ok: boolean; mensaje: string };

/**
 * Las dos puntas de una asignación.
 *
 * El padrón está afuera y necesita su propia conexión. La maratón, en cambio,
 * es la base de esta misma app: se escribe con el cliente de siempre.
 *
 * Al principio esto usaba el cliente cruzado `getClickatonJuryPrisma`, que es
 * el que usa FotoRank para llegar hasta acá. Era un error: obligaba a
 * configurar en Clickatón una variable que apunta a sí mismo, y sin ella la
 * pantalla decía "falta configurar la conexión" estando la base al alcance de
 * la mano. Ese cliente es para el camino de ida —FotoRank hacia Clickatón—, no
 * para que Clickatón se hable a sí mismo.
 */
function conexiones(): { padron: PadronPrisma | null; maraton: MaratonPrisma } {
  return {
    padron: getJuryDirectoryPrisma() as unknown as PadronPrisma | null,
    maraton: prisma as unknown as MaratonPrisma,
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

  const judgeAccountId = String(formData.get("judgeAccountId") ?? "").trim();
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  /*
   * El método se valida contra la lista conocida.
   *
   * Llega de un formulario, y un valor inventado haría fallar la escritura
   * contra el tipo de la base con un error que nadie entendería. Ante algo
   * raro, se usa el de siempre.
   */
  const metodoPedido = String(formData.get("methodType") ?? "");
  const methodType = esMetodoValido(metodoPedido) ? metodoPedido : METODO_POR_OMISION;
  const cupoPedido = Number(formData.get("quota"));
  const methodConfigJson = configDelMetodo(
    methodType,
    Number.isFinite(cupoPedido) ? cupoPedido : null,
  );

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
    methodType,
    methodConfigJson,
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

/**
 * La sesión de juzgamiento de esta edición, que es donde viven las vacantes.
 *
 * Nace al congelar el lote, así que antes de eso no hay dónde declarar nada y
 * la pantalla tiene que decirlo con todas las letras en vez de fallar.
 */
async function sesionDeLaEdicion(editionId: string) {
  return prisma.fotorankJuryScoringSession.findFirst({
    where: { admissionBatch: { editionId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plannedSeats: true,
      minimumEvaluationsPerEntry: true,
      recommendedMaxEntriesPerJudge: true,
    },
  });
}

export async function declararVacantesAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  await requireClickatonAdmin();

  const cuantos = Number(formData.get("cuantos") ?? 0);
  if (!Number.isFinite(cuantos) || cuantos < 1) {
    return { ok: false, mensaje: "Poné cuántos jurados van a ser." };
  }

  const sesion = await sesionDeLaEdicion(editionId);
  if (!sesion) {
    return {
      ok: false,
      mensaje:
        "Todavía no hay juzgamiento abierto para esta edición. Cerrá y congelá el lote de " +
        "admisión primero: ahí nace la sesión donde viven las vacantes.",
    };
  }

  const enviadas = await prisma.fotorankJuryEvaluation.count({
    where: { scoringSessionId: sesion.id, status: { in: ["SUBMITTED", "LOCKED"] } },
  });
  const permiso = sePuedeCambiarLaCantidad({ evaluacionesEnviadas: enviadas });
  if (!permiso.ok) return { ok: false, mensaje: permiso.motivo! };

  const n = Math.floor(cuantos);

  /*
   * Cuántas miradas junta cada obra sale de cuántos jurados va a haber, no de
   * cuántos hay hoy. Se fijaba al crear la sesión —cuando muchas veces hay uno
   * o dos— y quedaba en dos para siempre, aunque después el equipo creciera a
   * cinco: obras decididas por dos notas y sin nada con qué desempatar.
   */
  await prisma.fotorankJuryScoringSession.update({
    where: { id: sesion.id },
    data: {
      plannedSeats: n,
      minimumEvaluationsPerEntry: minimoDeEvaluacionesPorObra(n),
    },
  });

  refrescar(editionId);
  const miradas = minimoDeEvaluacionesPorObra(n);
  return {
    ok: true,
    mensaje:
      `Quedaron ${n} vacante${n === 1 ? "" : "s"} de jurado. ` +
      `Cada obra la van a mirar ${miradas}.`,
  };
}

export async function ajustarTopeDeCargaAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  await requireClickatonAdmin();

  const tope = Number(formData.get("tope") ?? 0);
  if (!Number.isFinite(tope) || tope < 1) {
    return { ok: false, mensaje: "Poné cuántas fotos como máximo le tocan a cada jurado." };
  }

  const sesion = await sesionDeLaEdicion(editionId);
  if (!sesion) {
    return { ok: false, mensaje: "Todavía no hay juzgamiento abierto para esta edición." };
  }

  await prisma.fotorankJuryScoringSession.update({
    where: { id: sesion.id },
    data: { recommendedMaxEntriesPerJudge: Math.floor(tope) },
  });

  refrescar(editionId);
  return { ok: true, mensaje: `El tope quedó en ${Math.floor(tope)} fotos por jurado.` };
}

/**
 * Reparte el lote de una vacante que nunca se llenó entre quienes sí están.
 *
 * Pide motivo por escrito porque le agrega obras a gente que quizá ya terminó:
 * dentro de un mes, cuando alguien pregunte por qué ese jurado tenía consignas
 * que no le tocaban, la respuesta tiene que estar guardada.
 */
export async function redistribuirVacanteAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  const user = await requireClickatonAdmin();

  const seatVacia = Number(formData.get("seatNumber") ?? 0);
  if (!Number.isFinite(seatVacia) || seatVacia < 1) {
    return { ok: false, mensaje: "Falta indicar qué vacante repartir." };
  }

  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 3) {
    return { ok: false, mensaje: "Escribí por qué estás repartiendo esta vacante." };
  }

  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { fotorankContestId: true },
  });
  if (!edicion?.fotorankContestId) {
    return { ok: false, mensaje: "Esta edición todavía no tiene su concurso creado." };
  }

  const sesion = await sesionDeLaEdicion(editionId);
  if (!sesion?.plannedSeats) {
    return { ok: false, mensaje: "Todavía no declaraste cuántos jurados van a ser." };
  }

  const [consignas, asignadas, excepciones] = await Promise.all([
    prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, title: true },
    }),
    prisma.fotorankJudgeAssignment.findMany({
      where: { contestId: edicion.fotorankContestId },
      select: { seatNumber: true, judgeAccountId: true, judgeAccount: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fotorankJurySeatPromptOverride.findMany({
      where: { scoringSessionId: sesion.id },
      select: { seatNumber: true, promptExternalId: true },
    }),
  ]);

  const vacantes = armarVacantes({
    plannedSeats: sesion.plannedSeats,
    consignas: consignas.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      titulo: c.title ?? `Consigna ${c.sequence}`,
    })),
    miradasPorObra: sesion.minimumEvaluationsPerEntry,
    ocupantes: asignadas.map((a) => ({
      seatNumber: a.seatNumber,
      judgeAccountId: a.judgeAccountId,
      nombre: a.judgeAccount?.email ?? null,
    })),
    excepciones,
  });

  const nuevas = repartirLoteHuerfano({ vacantes, seatVacia });
  if (nuevas.length === 0) {
    return {
      ok: false,
      mensaje:
        "No hay nada que repartir: o esa vacante está ocupada, o todavía no hay ningún " +
        "jurado a quien darle esas consignas.",
    };
  }

  await prisma.fotorankJurySeatPromptOverride.createMany({
    data: nuevas.map((n) => ({
      scoringSessionId: sesion.id,
      seatNumber: n.seatNumber,
      promptExternalId: n.promptExternalId,
      motivo,
      createdByUserId: user.id,
    })),
    skipDuplicates: true,
  });

  refrescar(editionId);
  return {
    ok: true,
    mensaje: `Se repartieron ${nuevas.length} consigna${nuevas.length === 1 ? "" : "s"}.`,
  };
}
