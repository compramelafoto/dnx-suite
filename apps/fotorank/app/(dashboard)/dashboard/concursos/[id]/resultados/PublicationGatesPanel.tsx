import Link from "next/link";
import {
  approveInstitutionalAction,
  approveLegalAction,
  configureFinalistsAction,
  deriveWinnersAction,
  publishStagingTestAction,
  revokePublicationAction,
  stagingConfirmAwardsAction,
  stagingConfirmRubricAction,
} from "../../../../../lib/fotorank/results/publication-actions";
import type { PublicationReadiness } from "../../../../../lib/fotorank/results/publication-types";
import { STAGING_TEST_PUBLICATION_PHRASE } from "../../../../../lib/fotorank/results/publication-types";

type Props = {
  contestId: string;
  batchId: string;
  readiness: PublicationReadiness;
};

export function PublicationGatesPanel({ contestId, batchId, readiness }: Props) {
  const meta = readiness.meta;
  return (
    <section
      className="fr-recuadro mb-12 space-y-6 border border-fr-border bg-fr-card"
      data-testid="publication-gates-panel"
    >
      <h2 className="text-lg font-semibold text-fr-primary">ETAPA 08 — Publicación controlada</h2>
      <p className="text-sm text-fr-muted leading-relaxed">
        El ranking privado no equivale a resultados oficiales. Rúbrica y premios pueden estar en{" "}
        <span className="text-amber-200">PENDING_ORGANIZER_DECISION</span>. Staging:{" "}
        <code className="text-xs">STAGING_TEST_CONFIGURATION</code> /{" "}
        <code className="text-xs">{STAGING_TEST_PUBLICATION_PHRASE}</code>.
      </p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2" data-testid="publication-readiness">
        <div>
          <dt className="text-fr-muted">Readiness</dt>
          <dd className="font-semibold" data-testid="publication-readiness-status">
            {readiness.status}
          </dd>
        </div>
        <div>
          <dt className="text-fr-muted">Hash preview</dt>
          <dd className="break-all font-mono text-xs">{readiness.publicationHash?.slice(0, 24) ?? "—"}…</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-fr-muted">Bloqueos</dt>
          <dd data-testid="publication-reason-codes">
            {readiness.reasonCodes.length ? readiness.reasonCodes.join(", ") : "ninguno"}
          </dd>
        </div>
        <div>
          <dt className="text-fr-muted">Rúbrica</dt>
          <dd>{meta?.rubricConfirmation?.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-fr-muted">Premios</dt>
          <dd>{meta?.awardsConfig?.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-fr-muted">Institucional</dt>
          <dd>{meta?.institutionalReview?.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-fr-muted">Legal</dt>
          <dd>{meta?.legalReview?.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-fr-muted">Publicación</dt>
          <dd data-testid="publication-status">{meta?.publication?.status ?? "PRIVATE"}</dd>
        </div>
        <div>
          <dt className="text-fr-muted">Finalistas / ganadores</dt>
          <dd>
            {(meta?.finalistSelections?.length ?? 0)} / {(meta?.winnerSelections?.length ?? 0)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <form action={stagingConfirmRubricAction.bind(null, contestId)}>
          <input type="hidden" name="batchId" value={batchId} />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm" data-testid="confirm-rubric-staging">
            Rúbrica STAGING_TEST
          </button>
        </form>
        <form action={stagingConfirmAwardsAction.bind(null, contestId)}>
          <input type="hidden" name="batchId" value={batchId} />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm" data-testid="confirm-awards-staging">
            Premios STAGING_TEST
          </button>
        </form>
        <form action={configureFinalistsAction.bind(null, contestId)}>
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="topN" value="3" />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm" data-testid="configure-finalists">
            Finalistas top 3
          </button>
        </form>
        <form action={deriveWinnersAction.bind(null, contestId)}>
          <input type="hidden" name="batchId" value={batchId} />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm" data-testid="derive-winners">
            Ganadores desde ranking
          </button>
        </form>
        <form action={approveInstitutionalAction.bind(null, contestId)}>
          <input type="hidden" name="batchId" value={batchId} />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm" data-testid="approve-institutional">
            Aprobar institucional
          </button>
        </form>
        <form action={approveLegalAction.bind(null, contestId)}>
          <input type="hidden" name="batchId" value={batchId} />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm" data-testid="approve-legal">
            Aprobar legal (staging)
          </button>
        </form>
        <Link
          href={`/dashboard/concursos/${contestId}/resultados/preview`}
          className="fr-btn fr-btn-secondary min-h-11 px-4 text-sm inline-flex items-center"
          data-testid="open-results-preview"
        >
          Preview privado
        </Link>
      </div>

      {readiness.status === "READY" && readiness.publicationHash ? (
        <form action={publishStagingTestAction.bind(null, contestId)} className="space-y-4 border-t border-fr-border pt-6">
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="expectedHash" value={readiness.publicationHash} />
          <input type="hidden" name="idempotencyKey" value={`staging-pub-${batchId}`} />
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Frase de confirmación</span>
            <input
              name="confirmationPhrase"
              className="fr-filter-input w-full max-w-xl"
              placeholder={STAGING_TEST_PUBLICATION_PHRASE}
              defaultValue={STAGING_TEST_PUBLICATION_PHRASE}
              data-testid="publish-confirm-phrase"
            />
          </label>
          <button type="submit" className="fr-btn fr-btn-primary min-h-11 px-5 text-sm" data-testid="publish-staging-test">
            Publicar STAGING_TEST
          </button>
        </form>
      ) : (
        <p className="text-sm text-amber-200" data-testid="publish-blocked-hint">
          Publicación bloqueada hasta readiness READY (rúbrica, premios, finalistas, ganadores,
          institucional, legal, batch FINALIZED, sin empates).
        </p>
      )}

      {meta?.publication?.status === "LIVE" ? (
        <form action={revokePublicationAction.bind(null, contestId)} className="border-t border-fr-border pt-6">
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="reason" value="staging revoke / cleanup" />
          <button type="submit" className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm" data-testid="revoke-publication">
            Revocar publicación staging
          </button>
        </form>
      ) : null}
    </section>
  );
}
