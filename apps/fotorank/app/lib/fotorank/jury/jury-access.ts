import { baseDelConcurso, type ClienteDeJurado } from "./baseDelConcurso";
import {
  asignacionesQuePuedeJuzgar,
  categoriasDondeCompiteElJurado,
  MENSAJE_COMPITE_EN_TODAS,
} from "./competir-y-juzgar";
import { JuryError } from "./errors";
import { consignasDeLaVacante, leTocaLaConsigna } from "./repartoPorConsigna";

const ACTIVE_ASSIGNMENT = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED", "ASSIGNED"] as const;

/**
 * Las consignas de una vacante, resueltas contra la base.
 *
 * Devuelve `null` —todas— cuando no hay vacantes declaradas o cuando esta
 * persona todavía no está sentada en ninguna. El reparto empieza a valer recién
 * cuando el organizador dice cuántos jurados van a ser.
 */
async function consignasSegunLaVacante(input: {
  db: ClienteDeJurado;
  contestId: string;
  seatNumber: number | null;
}): Promise<Set<string> | null> {
  if (input.seatNumber == null) return null;

  const sesion = await input.db.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plannedSeats: true,
      minimumEvaluationsPerEntry: true,
      admissionBatch: { select: { editionId: true } },
    },
  });
  if (!sesion?.plannedSeats) return null;

  /*
   * Las consignas de ESTA edición, no todas las liberadas.
   *
   * Sin el filtro entraban también las de las otras ediciones —25 en vez de
   * 11— y el reparto salía distinto del que muestra la pantalla del
   * organizador: el jurado veía consignas que no le tocaban y no veía las
   * suyas. Se descubrió probando la cola antes de que entrara nadie.
   */
  const [consignas, excepciones] = await Promise.all([
    input.db.clickatonPrompt.findMany({
      where: {
        status: { in: ["RELEASED", "CLOSED"] },
        ...(sesion.admissionBatch?.editionId
          ? { editionId: sesion.admissionBatch.editionId }
          : {}),
      },
      orderBy: { sequence: "asc" },
      select: { id: true },
    }),
    input.db.fotorankJurySeatPromptOverride.findMany({
      where: { scoringSessionId: sesion.id },
      select: { seatNumber: true, promptExternalId: true },
    }),
  ]);

  return consignasDeLaVacante({
    consignas: consignas.map((c) => c.id),
    vacantes: sesion.plannedSeats,
    miradasPorObra: sesion.minimumEvaluationsPerEntry,
    seatNumber: input.seatNumber,
    excepciones,
  });
}

export async function assertJudgeContestAccess(input: {
  judgeAccountId: string;
  contestId: string;
  categoryId?: string;
}) {
  const { db, esDeClickaton } = await baseDelConcurso(input.contestId);

  const judge = await db.fotorankJudgeAccount.findUnique({
    where: { id: input.judgeAccountId },
    select: { id: true, accountStatus: true },
  });
  if (!judge || judge.accountStatus !== "ACTIVE") {
    throw new JuryError("FORBIDDEN", "Cuenta de jurado no activa.", 403);
  }

  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: {
      id: true,
      status: true,
      title: true,
      slug: true,
      judgingEndAt: true,
      judgingStartAt: true,
    },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  if (contest.status === "ARCHIVED" || contest.status === "DRAFT") {
    throw new JuryError("FORBIDDEN", "El concurso no está habilitado para el jurado.", 403);
  }

  const asignadas = await db.fotorankJudgeAssignment.findMany({
    where: {
      contestId: input.contestId,
      judgeAccountId: input.judgeAccountId,
      assignmentStatus: { in: [...ACTIVE_ASSIGNMENT] },
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  if (asignadas.length === 0) {
    throw new JuryError("NOT_ASSIGNED", "No tenés asignación en este concurso.", 403);
  }

  /*
   * Nadie juzga la categoría donde compite.
   *
   * El filtro va acá, y no en cada pantalla, porque todo lo que el jurado
   * puede hacer —ver la cola, abrir una obra, votar, evaluar en cualquiera de
   * los dos motores— pasa por esta función y filtra por el `categoryIds` que
   * devuelve. Sacar la categoría de acá la saca de todas partes a la vez.
   */
  const enConflicto = await categoriasDondeCompiteElJurado({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });
  const assignments = asignacionesQuePuedeJuzgar(asignadas, enConflicto);

  if (assignments.length === 0) {
    // Tiene asignación pero no puede usar ninguna: decirle "no tenés
    // asignación" sería mentirle sobre la causa.
    throw new JuryError("COMPITE_EN_LA_CATEGORIA", MENSAJE_COMPITE_EN_TODAS, 403);
  }

  if (input.categoryId) {
    const hit = assignments.find((a) => a.categoryId === input.categoryId);
    if (!hit) {
      if (enConflicto.has(input.categoryId)) {
        throw new JuryError("COMPITE_EN_LA_CATEGORIA", MENSAJE_COMPITE_EN_TODAS, 403);
      }
      throw new JuryError("CATEGORY_NOT_ASSIGNED", "No estás asignado a esta categoría.", 403);
    }
  }

  /*
   * Qué consignas le tocan.
   *
   * Salen de la **vacante** que ocupa, no de la lista de asignados: el reparto
   * se calcula sobre vacantes numeradas para que sumar un jurado la semana que
   * viene no le mueva el lote a nadie. Va acá, en la misma compuerta que
   * resuelve la categoría, así ninguna pantalla tiene que acordarse de
   * aplicarlo.
   *
   * `null` = todas, que es el caso mientras el organizador no declare vacantes.
   * Que la ausencia de reparto abra todo y no cierre todo es a propósito: un
   * error acá no puede dejar a un jurado mirando una pantalla vacía.
   */
  const promptIds = await consignasSegunLaVacante({
    db,
    contestId: input.contestId,
    seatNumber: assignments.find((a) => a.seatNumber != null)?.seatNumber ?? null,
  });

  return {
    contest,
    assignments,
    categoryIds: assignments.map((a) => a.categoryId),
    promptIds,
    /** La base donde vive este concurso: la usan todas las pantallas del jurado. */
    db,
    esDeClickaton,
  };
}

export async function assertJuryEntryAccess(input: {
  judgeAccountId: string;
  contestId: string;
  entryId: string;
}) {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  const entry = await access.db.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      assets: {
        where: { isActive: true, kind: { in: ["JURY_PREVIEW", "THUMBNAIL", "ORIGINAL"] } },
      },
      checks: true,
      activeAsset: { include: { exifMetadata: true } },
      judgeConflicts: {
        where: { judgeAccountId: input.judgeAccountId, status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!entry) throw new JuryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  if (!access.categoryIds.includes(entry.categoryId)) {
    throw new JuryError("CATEGORY_NOT_ASSIGNED", "No estás asignado a la categoría de esta obra.", 403);
  }
  if (!leTocaLaConsigna(access.promptIds, entry.externalPromptId)) {
    throw new JuryError(
      "CATEGORY_NOT_ASSIGNED",
      "Esta consigna le tocó a otro jurado.",
      403,
    );
  }
  if (entry.status !== "CONFIRMED" || entry.withdrawnAt) {
    throw new JuryError("ENTRY_NOT_CONFIRMABLE", "La obra no está disponible para evaluación.", 403);
  }
  if (!entry.entryNumber && !entry.anonymousJuryCode) {
    throw new JuryError("ENTRY_NOT_CONFIRMABLE", "La obra no tiene código anónimo.", 403);
  }

  // Etapa 14: Clickatón / admisión aplicada → solo FROZEN_FOR_JURY.
  const admissionApplied = entry.admissionStatus != null;
  if (
    (entry.sourcePlatform === "CLICKATON" || admissionApplied) &&
    entry.admissionStatus !== "FROZEN_FOR_JURY"
  ) {
    throw new JuryError(
      "ENTRY_NOT_FROZEN",
      "La obra no está congelada para jurado.",
      403,
    );
  }

  const snapshot = await access.db.fotorankJuryEntrySnapshot.findFirst({
    where: {
      entryId: entry.id,
      contestId: input.contestId,
      batch: { status: "FROZEN" },
    },
    orderBy: { frozenAt: "desc" },
  });
  if ((entry.sourcePlatform === "CLICKATON" || admissionApplied) && !snapshot) {
    throw new JuryError("SNAPSHOT_MISSING", "No hay snapshot congelado para esta obra.", 404);
  }

  const juryPreview =
    entry.assets.find((a) => a.kind === "JURY_PREVIEW") ??
    entry.assets.find((a) => a.kind === "THUMBNAIL") ??
    (snapshot?.juryAssetId
      ? await access.db.fotorankContestEntryAsset.findUnique({ where: { id: snapshot.juryAssetId } })
      : null);
  if (!juryPreview) {
    throw new JuryError("PREVIEW_MISSING", "No hay preview de jurado disponible.", 404);
  }

  return { ...access, entry, juryPreview, snapshot };
}
