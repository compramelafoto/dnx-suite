import {
  activateRubricAction,
  closeScoringSessionAction,
  ensureScoringSessionAction,
  openScoringSessionAction,
} from "../../../../../lib/fotorank/jury/scoring-actions";
import { getCoverageReport } from "../../../../../lib/fotorank/jury/scoring-session-service";
import {
  activateResultRuleSetAction,
  ensureResultRuleSetAction,
  finalizeResultBatchAction,
  generateResultBatchAction,
} from "../../../../../lib/fotorank/results/result-actions";

type Batch = { id: string; frozenAt: Date | null; frozenEntries: number | null };
type Session = {
  id: string;
  status: string;
  scoringEnabled: boolean;
  minimumEvaluationsPerEntry: number;
  admissionBatchId: string;
  rubricId: string;
  openedAt: Date | null;
  closedAt: Date | null;
};
type Rubric = { id: string; name: string; status: string; version: number; criteriaCount: number };

type Props = {
  contestId: string;
  frozenBatches: Batch[];
  session: Session | null;
  rubric: Rubric | null;
  resultBatchId: string | null;
  ruleSetId: string | null;
};

export async function ScoringSessionPanel({
  contestId,
  frozenBatches,
  session,
  rubric,
  resultBatchId,
  ruleSetId,
}: Props) {
  const coverage =
    session && (session.status === "OPEN" || session.status === "CLOSED" || session.status === "LOCKED")
      ? await getCoverageReport(contestId, session.id)
      : null;

  const primaryBatch = frozenBatches[0];

  return (
    <section
      className="fr-recuadro mb-10 space-y-6 border border-fr-border bg-fr-card"
      data-testid="scoring-session-panel"
    >
      <div>
        <h2 className="text-lg font-semibold">Sesión de scoring (Etapa 14/15)</h2>
        <p className="mt-4 text-sm text-fr-muted">
          Fuente de verdad: <code className="text-gold">FotorankJuryEvaluation</code> sobre snapshots
          FROZEN. Ranking privado vía Etapa 15 (no LIVE). Vote legado no es canónico para Santa Fe.
        </p>
      </div>

      {!primaryBatch ? (
        <p className="text-sm text-amber-200" data-testid="scoring-no-frozen-batch">
          No hay batch FROZEN. Congelá obras admitidas desde Admisión antes de abrir el jurado.
        </p>
      ) : (
        <p className="text-sm text-fr-muted" data-testid="scoring-frozen-batch">
          Batch FROZEN: <span className="text-fr-primary">{primaryBatch.id.slice(0, 12)}…</span>
          {primaryBatch.frozenEntries != null ? ` · ${primaryBatch.frozenEntries} obras` : ""}
        </p>
      )}

      {session ? (
        <dl className="grid gap-4 sm:grid-cols-2 text-sm" data-testid="scoring-session-status">
          <div>
            <dt className="text-fr-muted">Estado sesión</dt>
            <dd className="mt-2 font-semibold text-fr-primary">{session.status}</dd>
          </div>
          <div>
            <dt className="text-fr-muted">Scoring habilitado</dt>
            <dd className="mt-2 font-semibold text-fr-primary">
              {session.scoringEnabled ? "sí" : "no"}
            </dd>
          </div>
          <div>
            <dt className="text-fr-muted">Mínimo evals / obra</dt>
            <dd className="mt-2 font-semibold text-fr-primary">
              {session.minimumEvaluationsPerEntry}
            </dd>
          </div>
          <div>
            <dt className="text-fr-muted">Rúbrica</dt>
            <dd className="mt-2 font-semibold text-fr-primary">
              {rubric
                ? `${rubric.name} · v${rubric.version} · ${rubric.status} · ${rubric.criteriaCount} criterios`
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-fr-muted">Sin sesión DRAFT/OPEN todavía.</p>
      )}

      {coverage ? (
        <div
          className="rounded-xl border border-fr-border bg-fr-bg/40 px-4 py-4 text-sm space-y-2"
          data-testid="scoring-coverage"
        >
          <p className="font-semibold text-fr-primary">Cobertura (dry-run cierre)</p>
          <p className="text-fr-muted">
            Completas: {coverage.completeEntries}/{coverage.totalEntries} · Incompletas:{" "}
            {coverage.incompleteEntries} · Evals enviadas: {coverage.submittedEvaluations} ·
            Conflictos activos: {coverage.activeConflicts} · Mínimo: {coverage.minimumPerEntry}
          </p>
          {coverage.incompleteEntries > 0 || coverage.activeConflicts > 0 ? (
            <p className="text-amber-200">
              El cierre normal está bloqueado hasta completar cobertura y resolver conflictos.
            </p>
          ) : (
            <p className="text-emerald-300">Cobertura OK para cierre.</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {primaryBatch ? (
          <form action={ensureScoringSessionAction.bind(null, contestId)}>
            <input type="hidden" name="admissionBatchId" value={primaryBatch.id} />
            <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
              Crear / asegurar sesión
            </button>
          </form>
        ) : null}

        {session && rubric && rubric.status !== "ACTIVE" ? (
          <form action={activateRubricAction.bind(null, contestId)}>
            <input type="hidden" name="rubricId" value={rubric.id} />
            <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
              Activar rúbrica
            </button>
          </form>
        ) : null}

        {session && rubric?.status === "ACTIVE" && session.status !== "OPEN" && session.status !== "CLOSED" ? (
          <form action={openScoringSessionAction.bind(null, contestId)}>
            <input type="hidden" name="sessionId" value={session.id} />
            <button
              type="submit"
              className="fr-btn fr-btn-primary min-h-11 px-5 text-sm"
              data-testid="scoring-open"
            >
              Abrir ronda
            </button>
          </form>
        ) : null}

        {session && session.status === "OPEN" ? (
          <form action={closeScoringSessionAction.bind(null, contestId)}>
            <input type="hidden" name="sessionId" value={session.id} />
            <button
              type="submit"
              className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
              data-testid="scoring-close"
            >
              Cerrar ronda (exige cobertura)
            </button>
          </form>
        ) : null}

        {session && (session.status === "CLOSED" || session.status === "LOCKED") ? (
          <>
            <form action={ensureResultRuleSetAction.bind(null, contestId)}>
              <input type="hidden" name="scoringSessionId" value={session.id} />
              <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                Asegurar reglas ranking
              </button>
            </form>
            {ruleSetId ? (
              <form action={activateResultRuleSetAction.bind(null, contestId)}>
                <input type="hidden" name="ruleSetId" value={ruleSetId} />
                <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                  Activar reglas
                </button>
              </form>
            ) : null}
            {ruleSetId ? (
              <form action={generateResultBatchAction.bind(null, contestId)}>
                <input type="hidden" name="scoringSessionId" value={session.id} />
                <input type="hidden" name="ruleSetId" value={ruleSetId} />
                <button
                  type="submit"
                  className="fr-btn fr-btn-primary min-h-11 px-5 text-sm"
                  data-testid="scoring-generate-ranking"
                >
                  Generar ranking privado
                </button>
              </form>
            ) : null}
            {resultBatchId ? (
              <form action={finalizeResultBatchAction.bind(null, contestId)}>
                <input type="hidden" name="batchId" value={resultBatchId} />
                <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm">
                  Finalizar batch (privado)
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </div>

      <p className="text-xs text-fr-muted">
        BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR. El ranking privado no es resultado público.
      </p>
    </section>
  );
}
