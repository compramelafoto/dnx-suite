/**
 * Todo lo que el visor necesita para una tanda de calificación, en una sola
 * consulta: las obras que le tocan al jurado, lo que ya puso en cada una, y la
 * rúbrica con la que las califica.
 *
 * Va junto a propósito. El visor no recarga la página entre foto y foto —se
 * mueve con las flechas y el Tab—, así que si los datos llegaran de a uno cada
 * pulsación sería una espera.
 */
import { getContestEntryStorage } from "../storage/provider";
import { signedPreviewUrl } from "./entry-for-juror";
import { assertJudgeContestAccess } from "./jury-access";
import { sortEntriesForJuror } from "./jury-order";
import { leTocaLaConsigna } from "./repartoPorConsigna";
import type { ObraEnElVisor } from "./colaDelVisor";

/** Diez minutos: lo que dura una tanda sin que se venzan los enlaces. */
const PREVIEW_TTL_SEC = 600;

export type CriterioDelVisor = {
  key: string;
  nombre: string;
  descripcion: string | null;
  min: number;
  max: number;
};

export type ConsignaDelVisor = {
  numero: number;
  titulo: string;
  /**
   * La consigna tal como la leyó quien fotografió.
   *
   * El jurado estaba calificando "adecuación a la consigna" viendo sólo el
   * título. Sin el texto completo esa nota es una adivinanza: "Sombras" no
   * dice que la sombra tenga que ser la protagonista y no el resto de la
   * escena, que es lo que se le pidió al participante.
   */
  texto: string;
};

export type ColaDelVisor = {
  contestTitle: string;
  judgingEndsAt: string | null;
  rubrica: { id: string; nombre: string; criterios: CriterioDelVisor[] } | null;
  consignas: ConsignaDelVisor[];
  obras: ObraEnElVisor[];
  /** Sin sesión abierta se puede mirar, no calificar. */
  sePuedeCalificar: boolean;
};

export async function colaParaElVisor(input: {
  judgeAccountId: string;
  contestId: string;
}): Promise<ColaDelVisor> {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  /*
   * La base del concurso, no la de casa.
   *
   * Una maratón tiene su lote, sus obras y sus evaluaciones en la base de
   * Clickatón. La compuerta ya resolvió cuál es; acá se usa esa misma, porque
   * preguntar de nuevo podría dar otra respuesta.
   */
  const db = access.db;

  const lote = await db.fotorankAdmissionBatch.findFirst({
    where: { contestId: input.contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
    select: { id: true },
  });

  const sesion = await db.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN", scoringEnabled: true },
    orderBy: { openedAt: "desc" },
    include: {
      rubric: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  const rubrica = sesion?.rubric
    ? {
        id: sesion.rubric.id,
        nombre: sesion.rubric.name,
        criterios: sesion.rubric.criteria.map((c) => ({
          key: c.key,
          nombre: c.name,
          descripcion: c.description,
          min: c.minScore,
          max: c.maxScore,
        })),
      }
    : null;

  if (!lote) {
    return {
      contestTitle: access.contest.title,
      judgingEndsAt: access.contest.judgingEndAt?.toISOString() ?? null,
      rubrica,
      consignas: [],
      obras: [],
      sePuedeCalificar: false,
    };
  }

  const conflictos = await db.fotorankJudgeEntryConflict.findMany({
    where: {
      contestId: input.contestId,
      judgeAccountId: input.judgeAccountId,
      status: "ACTIVE",
    },
    select: { entryId: true },
  });
  const enConflicto = new Set(conflictos.map((c) => c.entryId));

  const snapshots = await db.fotorankJuryEntrySnapshot.findMany({
    where: {
      admissionBatchId: lote.id,
      categoryId: { in: access.categoryIds },
    },
    include: {
      entry: {
        select: {
          id: true,
          assets: {
            where: {
              isActive: true,
              kind: { in: ["JURY_PREVIEW", "THUMBNAIL"] },
            },
          },
        },
      },
    },
  });

  const promptIds = [
    ...new Set(
      snapshots.map((s) => s.promptExternalId).filter(Boolean) as string[],
    ),
  ];
  const prompts = promptIds.length
    ? await db.clickatonPrompt.findMany({
        where: {
          id: { in: promptIds },
          status: { in: ["RELEASED", "CLOSED"] },
        },
        select: {
          id: true,
          sequence: true,
          title: true,
          instructions: true,
          shortDescription: true,
        },
      })
    : [];
  const promptPorId = new Map(prompts.map((p) => [p.id, p]));

  const evaluaciones = await db.fotorankJuryEvaluation.findMany({
    where: {
      jurorId: input.judgeAccountId,
      admissionBatchId: lote.id,
      juryEntrySnapshotId: { in: snapshots.map((s) => s.id) },
    },
    include: { criterionScores: true },
  });
  const evaluacionPorSnapshot = new Map(
    evaluaciones.map((e) => [e.juryEntrySnapshotId, e]),
  );

  const storage = getContestEntryStorage();
  const esDeClickaton = access.esDeClickaton;
  const baseDeClickaton =
    process.env.CLICKATON_PUBLIC_BASE_URL?.trim() ||
    "https://maratonfotografica.com";
  const ahora = new Date();
  const obras: ObraEnElVisor[] = [];

  for (const snap of snapshots) {
    if (enConflicto.has(snap.entryId)) continue;
    if (!leTocaLaConsigna(access.promptIds, snap.promptExternalId)) continue;

    const asset =
      snap.entry.assets.find((a) => a.kind === "JURY_PREVIEW") ??
      snap.entry.assets.find((a) => a.kind === "THUMBNAIL") ??
      (snap.juryAssetId
        ? await db.fotorankContestEntryAsset.findUnique({
            where: { id: snap.juryAssetId },
          })
        : null);
    if (!asset) continue;

    /*
     * De dónde sale la foto.
     *
     * Las obras de una maratón viven en el bucket privado de Clickatón y
     * FotoRank no tiene sus llaves: firma un enlace con el secreto compartido y
     * el navegador del jurado le pide la imagen a Clickatón. Pedírsela al
     * almacenamiento propio devolvía una imagen rota.
     */
    let previewUrl: string | null = null;
    try {
      previewUrl = esDeClickaton
        ? signedPreviewUrl(asset.id, baseDeClickaton, ahora)
        : await storage.getSignedUrl(asset.storageKey, "read", PREVIEW_TTL_SEC);
    } catch {
      previewUrl = null;
    }

    const prompt = snap.promptExternalId
      ? promptPorId.get(snap.promptExternalId)
      : null;
    const textoDeLaConsigna =
      prompt?.instructions?.trim() || prompt?.shortDescription?.trim() || "";
    const evaluacion = evaluacionPorSnapshot.get(snap.id);

    const notas: Record<string, number> = {};
    for (const linea of evaluacion?.criterionScores ?? []) {
      if (typeof linea.score === "number")
        notas[linea.criterionKeySnapshot] = linea.score;
    }

    obras.push({
      entryId: snap.entryId,
      snapshotId: snap.id,
      codigo: snap.anonymousCode,
      consignaNumero: prompt?.sequence ?? null,
      consignaTitulo: prompt?.title ?? null,
      consignaTexto: textoDeLaConsigna,
      previewUrl,
      notas,
      comentario: evaluacion?.privateComment ?? "",
      enviada:
        evaluacion?.status === "SUBMITTED" || evaluacion?.status === "LOCKED",
    });
  }

  /*
   * El orden dentro de cada consigna sigue barajado por el hash de siempre: que
   * no se pueda deducir quién subió qué, ni que el orden empuje la nota.
   */
  const ordenadas = sortEntriesForJuror(
    obras,
    input.judgeAccountId,
    input.contestId,
  );

  const consignas: ConsignaDelVisor[] = [
    ...new Map(
      ordenadas
        .filter((o) => o.consignaNumero !== null)
        .map((o) => [
          o.consignaNumero!,
          {
            numero: o.consignaNumero!,
            titulo: o.consignaTitulo ?? `Consigna ${o.consignaNumero}`,
            texto: o.consignaTexto ?? "",
          },
        ]),
    ).values(),
  ].sort((a, b) => a.numero - b.numero);

  return {
    contestTitle: access.contest.title,
    judgingEndsAt: access.contest.judgingEndAt?.toISOString() ?? null,
    rubrica,
    consignas,
    // El `sortKey` con el que se barajó no viaja al cliente: sirvió para ordenar
    // y afuera sólo sería una pista más sobre el orden.
    obras: ordenadas.map((o) => ({
      entryId: o.entryId,
      snapshotId: o.snapshotId,
      codigo: o.codigo,
      consignaNumero: o.consignaNumero,
      consignaTitulo: o.consignaTitulo,
      previewUrl: o.previewUrl,
      notas: o.notas,
      comentario: o.comentario,
      enviada: o.enviada,
    })),
    sePuedeCalificar: Boolean(
      sesion && rubrica && rubrica.criterios.length > 0,
    ),
  };
}
