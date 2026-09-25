"use server";

/**
 * Lo que el visor le pide al servidor mientras el jurado califica.
 *
 * Cada nota se guarda en el momento y **no bloquea nada**: la obra queda
 * guardada pero se puede cambiar hasta que el jurado envía todo. Recién ahí se
 * cierra, y las que quedaron a medias no entran.
 */
import { prisma } from "@repo/db";

import { requireJudgeAuth } from "../lib/judge-auth";
import { JuryError } from "../lib/fotorank/jury/errors";
import { upsertJuryEvaluation } from "../lib/fotorank/jury/evaluation-service";
import { sumarAlLatido } from "../lib/fotorank/jury/ritmoDelJurado";

export type ResultadoDelVisor = { ok: boolean; mensaje?: string };

/**
 * Guarda una nota sola.
 *
 * El motor recibe la tanda completa de la obra, así que el visor manda todo lo
 * que tiene puesto: la nota nueva y las que ya estaban. Sin `submit`, o sea
 * guardado y editable.
 */
export async function guardarNotaAction(input: {
  contestId: string;
  snapshotId: string;
  notas: Array<{ key: string; score: number }>;
  /**
   * El comentario privado de la obra, opcional.
   *
   * Sin mandarlo (`undefined`) queda el que hubiera; mandando texto vacío se
   * borra. La lista de notas puede venir vacía: eso borra las que había, que
   * es lo que pasa cuando el jurado deja una obra en blanco para volver.
   */
  comentario?: string | null;
}): Promise<ResultadoDelVisor> {
  const judge = await requireJudgeAuth();

  try {
    await upsertJuryEvaluation({
      judgeAccountId: judge.id,
      contestId: input.contestId,
      snapshotId: input.snapshotId,
      scores: input.notas,
      privateComment: input.comentario,
      submit: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof JuryError)
      return { ok: false, mensaje: error.message };
    return {
      ok: false,
      mensaje: "No pudimos guardar la calificación. Probá de nuevo.",
    };
  }
}

/**
 * Envía las obras terminadas.
 *
 * Las que tienen alguna nota faltando no se envían: el motor exige todos los
 * criterios al enviar, y forzarlas sería inventar una nota que el jurado no
 * puso. El visor avisa cuántas quedaron afuera.
 */
export async function enviarCalificacionesAction(input: {
  contestId: string;
  obras: Array<{
    snapshotId: string;
    notas: Array<{ key: string; score: number }>;
  }>;
}): Promise<ResultadoDelVisor & { enviadas: number; fallaron: number }> {
  const judge = await requireJudgeAuth();

  let enviadas = 0;
  let fallaron = 0;
  let primerError: string | null = null;

  for (const obra of input.obras) {
    try {
      await upsertJuryEvaluation({
        judgeAccountId: judge.id,
        contestId: input.contestId,
        snapshotId: obra.snapshotId,
        scores: obra.notas,
        submit: true,
      });
      enviadas += 1;
    } catch (error) {
      fallaron += 1;
      if (!primerError && error instanceof JuryError)
        primerError = error.message;
    }
  }

  if (enviadas === 0 && fallaron > 0) {
    return {
      ok: false,
      enviadas,
      fallaron,
      mensaje: primerError ?? "No pudimos enviar las calificaciones.",
    };
  }

  return {
    ok: true,
    enviadas,
    fallaron,
    mensaje:
      fallaron > 0
        ? `Se enviaron ${enviadas}. Quedaron ${fallaron} sin enviar.`
        : `Se enviaron ${enviadas} calificaciones.`,
  };
}

/**
 * El latido que mide el tiempo de trabajo.
 *
 * Lo manda el visor cada tanto mientras la pantalla está a la vista y hay
 * actividad. Si el jurado minimizó, se fue a otra solapa o dejó de tocar el
 * teclado, el visor no lo manda y el tiempo no corre.
 */
export async function latidoDelVisorAction(input: {
  contestId: string;
  segundosDesdeElUltimo: number;
}): Promise<{ segundosActivos: number; calificadas: number }> {
  const judge = await requireJudgeAuth();

  const sesion = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });

  const existente = await prisma.fotorankJuryActivityHeartbeat.findFirst({
    where: { contestId: input.contestId, jurorId: judge.id },
    select: { id: true, activeSecondsAccumulated: true },
  });

  const acumulado = sumarAlLatido({
    acumulado: existente?.activeSecondsAccumulated ?? 0,
    segundosDesdeElUltimo: input.segundosDesdeElUltimo,
    // El visor sólo llama cuando las dos condiciones se cumplen; acá se confía
    // en eso y no se pregunta de nuevo, porque el servidor no puede saberlo.
    pantallaVisible: true,
    huboInteraccion: true,
  });

  if (existente) {
    await prisma.fotorankJuryActivityHeartbeat.update({
      where: { id: existente.id },
      data: {
        activeSecondsAccumulated: acumulado,
        lastActiveAt: new Date(),
        scoringSessionId: sesion?.id ?? null,
      },
    });
  } else {
    await prisma.fotorankJuryActivityHeartbeat.create({
      data: {
        contestId: input.contestId,
        jurorId: judge.id,
        scoringSessionId: sesion?.id ?? null,
        lastActiveAt: new Date(),
        activeSecondsAccumulated: acumulado,
      },
    });
  }

  const calificadas = await prisma.fotorankJuryEvaluation.count({
    where: {
      jurorId: judge.id,
      contestId: input.contestId,
      status: { in: ["IN_PROGRESS", "SUBMITTED", "LOCKED"] },
    },
  });

  return { segundosActivos: acumulado, calificadas };
}
