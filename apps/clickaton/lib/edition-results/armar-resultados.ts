/**
 * El ranking de una edición, parcial o final, listo para mostrar.
 *
 * Final: si FotoRank ya cerró un lote (FINALIZED o PUBLISHED), manda ese; es la
 * fuente de premios y diplomas y no se recalcula acá.
 *
 * Parcial: mientras el jurado califica, se calcula en vivo con el mismo motor
 * del cierre (`@repo/jury-ranking`) y las notas ya enviadas. El mínimo de
 * miradas baja a 1 para que toda obra con alguna nota tenga puesto provisorio;
 * la cantidad de miradas se muestra al lado para no confundir parcial con final.
 */
import {
  assignPreliminaryAwards,
  computeRanking,
  type AggregationMethod,
  type ResultRuleInput,
  type TieBreakStrategy,
} from "@repo/jury-ranking";

/*
 * Espejo de la regla de fábrica de una maratón en FotoRank
 * (`ensureDraftResultRuleSet` y `clickaton-2026-rubric.ts`). Se usa sólo si
 * todavía nadie creó la regla del concurso.
 */
export const REGLA_DE_FABRICA_DE_MARATON = {
  aggregationMethod: "WEIGHTED_AVERAGE" as AggregationMethod,
  tieBreakStrategy: "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION" as TieBreakStrategy,
  discardHighestScore: false,
  discardLowestScore: false,
  priorityCriterionKey: "prompt_fit",
  winnersPerScope: 3,
  ruleSetVersion: 0,
};

export type ObraCongelada = {
  snapshotId: string;
  anonymousCode: string;
  categoryId: string;
  promptExternalId: string | null;
  admissionStatus: string;
  entryStatus: string;
};

export type NotaDeJurado = {
  snapshotId: string;
  status: string;
  totalScore: number | null;
  normalizedScore: number | null;
  priorityCriterionScore: number | null;
};

export type ReglaDeResultados = Omit<ResultRuleInput, "minimumValidEvaluations"> & {
  minimumValidEvaluations: number;
};

export type FilaDeLoteFinal = {
  snapshotId: string;
  aggregateScore: number | null;
  evaluationCount: number;
  preliminaryPosition: number | null;
  finalPosition: number | null;
  awardType: string | null;
  resultStatus: string;
};

export type FilaDeResultado = {
  snapshotId: string;
  anonymousCode: string;
  promptExternalId: string | null;
  puesto: number | null;
  nota: number | null;
  miradas: number;
  premio: string | null;
  empatada: boolean;
};

export type ResultadosDeEdicion = {
  modo: "FINAL" | "PARCIAL";
  miradasPorObra: number;
  filas: FilaDeResultado[];
};

const ESTADOS_ENVIADOS = new Set(["SUBMITTED", "LOCKED"]);

export function armarResultados(input: {
  obras: ObraCongelada[];
  notas: NotaDeJurado[];
  regla: ReglaDeResultados;
  loteFinal: FilaDeLoteFinal[] | null;
}): ResultadosDeEdicion {
  const miradasPorObra = Math.max(1, input.regla.minimumValidEvaluations);
  const porSnapshot = new Map(input.obras.map((o) => [o.snapshotId, o]));

  if (input.loteFinal) {
    const filas = input.loteFinal.flatMap((f): FilaDeResultado[] => {
      const obra = porSnapshot.get(f.snapshotId);
      if (!obra) return [];
      return [
        {
          snapshotId: f.snapshotId,
          anonymousCode: obra.anonymousCode,
          promptExternalId: obra.promptExternalId,
          puesto: f.finalPosition ?? f.preliminaryPosition,
          nota: f.aggregateScore,
          miradas: f.evaluationCount,
          premio: f.awardType,
          empatada: f.resultStatus === "TIED",
        },
      ];
    });
    return { modo: "FINAL", miradasPorObra, filas: ordenar(filas) };
  }

  const { works } = computeRanking({
    entries: input.obras,
    evaluations: input.notas
      .filter((n) => ESTADOS_ENVIADOS.has(n.status))
      .map((n) => {
        const obra = porSnapshot.get(n.snapshotId);
        return {
          snapshotId: n.snapshotId,
          anonymousCode: obra?.anonymousCode ?? "",
          categoryId: obra?.categoryId ?? "",
          promptExternalId: obra?.promptExternalId ?? null,
          totalScore: n.totalScore ?? 0,
          normalizedScore: n.normalizedScore ?? 0,
          priorityCriterionScore: n.priorityCriterionScore,
          status: n.status as "SUBMITTED" | "LOCKED",
        };
      }),
    rules: { ...input.regla, minimumValidEvaluations: 1 },
    scope: "CATEGORY_AND_PROMPT",
  });
  const conPremios = assignPreliminaryAwards(works, input.regla.winnersPerScope ?? 1);

  const filas = conPremios.map(
    (w): FilaDeResultado => ({
      snapshotId: w.snapshotId,
      anonymousCode: w.anonymousCode,
      promptExternalId: w.promptExternalId,
      puesto: w.preliminaryPosition,
      nota: w.aggregateScore,
      miradas: w.evaluationCount,
      premio: w.awardType,
      empatada: w.resultStatus === "TIED",
    }),
  );
  return { modo: "PARCIAL", miradasPorObra, filas: ordenar(filas) };
}

function ordenar(filas: FilaDeResultado[]): FilaDeResultado[] {
  return [...filas].sort((a, b) => {
    const pa = a.puesto ?? Number.POSITIVE_INFINITY;
    const pb = b.puesto ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.anonymousCode.localeCompare(b.anonymousCode);
  });
}

/** Agrupa las filas por consigna, en el orden de las consignas. */
export function porConsigna<T extends { promptExternalId: string | null }>(
  filas: T[],
  consignas: { id: string }[],
): { consignaId: string | null; filas: T[] }[] {
  const grupos = new Map<string | null, T[]>();
  for (const c of consignas) grupos.set(c.id, []);
  for (const f of filas) {
    const lista = grupos.get(f.promptExternalId) ?? [];
    lista.push(f);
    grupos.set(f.promptExternalId, lista);
  }
  return [...grupos.entries()].map(([consignaId, lista]) => ({ consignaId, filas: lista }));
}

const NOMBRE_DEL_PREMIO: Record<string, string> = {
  FIRST_PLACE: "1er puesto",
  SECOND_PLACE: "2do puesto",
  THIRD_PLACE: "3er puesto",
  FINALIST: "Finalista",
  HONORABLE_MENTION: "Mención",
  SPECIAL: "Premio especial",
};

export function nombreDelPremio(premio: string | null): string | null {
  if (!premio) return null;
  return NOMBRE_DEL_PREMIO[premio] ?? premio;
}
