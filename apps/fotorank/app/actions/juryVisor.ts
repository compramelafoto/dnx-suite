"use server";

/**
 * Lo que el visor le pide al servidor mientras el jurado califica.
 *
 * Cada nota se guarda en el momento y **no bloquea nada**: la obra queda
 * guardada pero se puede cambiar hasta que el jurado envía todo. Recién ahí se
 * cierra, y las que quedaron a medias no entran.
 */
import { requireJudgeAuth } from "../lib/judge-auth";
import { JuryError } from "../lib/fotorank/jury/errors";
import { upsertJuryEvaluation } from "../lib/fotorank/jury/evaluation-service";
import { colaParaElVisor } from "../lib/fotorank/jury/visor-service";
import {
  limpiarTiempoPorFoto,
  sumarAlLatido,
} from "../lib/fotorank/jury/ritmoDelJurado";
import {
  baseDelConcurso,
  type ClienteDeJurado,
} from "../lib/fotorank/jury/baseDelConcurso";

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
 * Renueva los enlaces de las fotografías.
 *
 * Los enlaces se firman con vencimiento --quince minutos para una maratón--
 * y se firmaban todos una sola vez, al abrir el visor. Calificar 170 obras
 * lleva horas: pasado ese rato, **ninguna** fotografía cargaba y el jurado se
 * quedaba mirando el ícono de imagen rota sin entender por qué.
 *
 * Devuelve la cola entera con los enlaces nuevos. El visor se queda sólo con
 * las direcciones: lo que el jurado ya calificó vive en su pantalla y en su
 * cola de pendientes, y pisarlo con lo que tiene el servidor sería borrarle
 * trabajo recién hecho.
 */
export async function renovarFotosAction(input: {
  contestId: string;
}): Promise<Array<{ entryId: string; previewUrl: string | null }>> {
  const judge = await requireJudgeAuth();
  try {
    const cola = await colaParaElVisor({
      judgeAccountId: judge.id,
      contestId: input.contestId,
    });
    return cola.obras.map((o) => ({ entryId: o.entryId, previewUrl: o.previewUrl }));
  } catch {
    // Si falla, el visor se queda con los enlaces que tenía: puede que sigan
    // sirviendo, y en el peor caso lo reintenta en la vuelta siguiente.
    return [];
  }
}

/**
 * El latido que mide el tiempo de trabajo.
 *
 * Lo manda el visor cada tanto mientras la pantalla está a la vista y hay
 * actividad. Si el jurado minimizó, se fue a otra solapa o dejó de tocar el
 * teclado, el visor no lo manda y el tiempo no corre.
 *
 * Escribe en la base del concurso. Escribía siempre en la de FotoRank, y una
 * maratón vive en la de Clickatón: el concurso no existía ahí, la escritura
 * fallaba y el visor tiraba el error en silencio. En la 1ª edición de
 * Clickatón no quedó guardado ni un segundo.
 *
 * Además del total, anota el tiempo de cada foto en su calificación. La
 * columna existía desde la etapa 16A y nadie la escribía.
 */
export async function latidoDelVisorAction(input: {
  contestId: string;
  segundosDesdeElUltimo: number;
  porFoto?: Array<{ snapshotId: string; segundos: number }>;
}): Promise<{
  segundosActivos: number;
  calificadas: number;
  fotosAnotadas: string[];
}> {
  const judge = await requireJudgeAuth();
  const { db } = await baseDelConcurso(input.contestId);

  const sesion = await db.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });

  const existente = await db.fotorankJuryActivityHeartbeat.findFirst({
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
    await db.fotorankJuryActivityHeartbeat.update({
      where: { id: existente.id },
      data: {
        activeSecondsAccumulated: acumulado,
        lastActiveAt: new Date(),
        scoringSessionId: sesion?.id ?? null,
      },
    });
  } else {
    await db.fotorankJuryActivityHeartbeat.create({
      data: {
        contestId: input.contestId,
        jurorId: judge.id,
        scoringSessionId: sesion?.id ?? null,
        lastActiveAt: new Date(),
        activeSecondsAccumulated: acumulado,
      },
    });
  }

  const fotosAnotadas = await anotarTiempoDeLasFotos(db, {
    contestId: input.contestId,
    jurorId: judge.id,
    porFoto: limpiarTiempoPorFoto(input.porFoto),
  });

  const calificadas = await db.fotorankJuryEvaluation.count({
    where: {
      jurorId: judge.id,
      contestId: input.contestId,
      status: { in: ["IN_PROGRESS", "SUBMITTED", "LOCKED"] },
    },
  });

  return { segundosActivos: acumulado, calificadas, fotosAnotadas };
}

/**
 * Suma los segundos a la calificación de cada foto.
 *
 * Sólo a las que ya tienen fila: una foto mirada antes de la primera nota no
 * la tiene todavía, y su tiempo vuelve en el latido siguiente. Devuelve cuáles
 * quedaron anotadas para que el visor las descuente.
 */
async function anotarTiempoDeLasFotos(
  db: ClienteDeJurado,
  input: {
    contestId: string;
    jurorId: string;
    porFoto: Array<{ snapshotId: string; segundos: number }>;
  },
): Promise<string[]> {
  if (input.porFoto.length === 0) return [];

  const conFila = await db.fotorankJuryEvaluation.findMany({
    where: {
      contestId: input.contestId,
      jurorId: input.jurorId,
      juryEntrySnapshotId: { in: input.porFoto.map((f) => f.snapshotId) },
      voidedAt: null,
    },
    select: { id: true, juryEntrySnapshotId: true },
  });
  if (conFila.length === 0) return [];

  const segundosDe = new Map(input.porFoto.map((f) => [f.snapshotId, f.segundos]));
  await db.$transaction(
    conFila.map((e) =>
      db.fotorankJuryEvaluation.update({
        where: { id: e.id },
        data: {
          activeSecondsAccumulated: {
            increment: segundosDe.get(e.juryEntrySnapshotId) ?? 0,
          },
        },
      }),
    ),
  );

  return [...new Set(conFila.map((e) => e.juryEntrySnapshotId))];
}
