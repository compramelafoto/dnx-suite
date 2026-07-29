import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireJudgeAuth } from "../../../../../lib/judge-auth";
import { JuryError, getAnonymousEntryDetailForJuror } from "../../../../../lib/fotorank/jury";
import { JuryConflictForm } from "./JuryConflictForm";
import { JuryEvaluationForm } from "./JuryEvaluationForm";

type Props = { params: Promise<{ contestId: string; entryId: string }> };

export default async function JuryEntryDetailPage({ params }: Props) {
  const judge = await requireJudgeAuth();
  const { contestId, entryId } = await params;

  let entry: Awaited<ReturnType<typeof getAnonymousEntryDetailForJuror>>;
  try {
    entry = await getAnonymousEntryDetailForJuror({
      judgeAccountId: judge.id,
      contestId,
      entryId,
    });
  } catch (err) {
    if (err instanceof JuryError && err.code === "ENTRY_NOT_FOUND") notFound();
    if (
      err instanceof JuryError &&
      (err.code === "FORBIDDEN" ||
        err.code === "CATEGORY_NOT_ASSIGNED" ||
        err.code === "NOT_ASSIGNED" ||
        err.code === "ENTRY_NOT_CONFIRMABLE" ||
        err.code === "ENTRY_NOT_FROZEN" ||
        err.code === "SNAPSHOT_MISSING")
    ) {
      redirect(`/jurado/concursos/${contestId}`);
    }
    throw err;
  }

  return (
    <div className="min-h-screen bg-fr-bg px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl space-y-10">
        <div>
          <Link
            href={`/jurado/concursos/${contestId}`}
            className="text-sm text-gold hover:text-gold-hover"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-6 font-sans text-3xl font-semibold text-gold" data-testid="jury-anonymous-code">
            {entry.anonymousCode}
          </h1>
          <p className="mt-4 text-sm text-fr-muted">Categoría: {entry.categoryName}</p>
          {entry.promptSequence != null ? (
            <p className="mt-2 text-sm text-fr-primary">
              Consigna {entry.promptSequence}
              {entry.promptTitle ? ` — ${entry.promptTitle}` : ""}
            </p>
          ) : null}
        </div>

        {entry.previewUrl ? (
          <section className="fr-recuadro border border-fr-border bg-fr-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.previewUrl}
              alt="Vista de jurado"
              className="max-h-[32rem] w-full object-contain bg-black"
              data-testid="jury-preview"
            />
            <p className="mt-4 text-xs text-fr-muted">
              Preview firmado de corta duración · el original no está disponible.
            </p>
          </section>
        ) : null}

        {entry.promptInstructions ? (
          <section className="fr-recuadro space-y-3 border border-fr-border bg-fr-card">
            <h2 className="text-lg font-semibold text-fr-primary">Texto de la consigna</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fr-primary">
              {entry.promptInstructions}
            </p>
          </section>
        ) : null}

        {entry.rubric && entry.snapshotId ? (
          <JuryEvaluationForm
            contestId={contestId}
            snapshotId={entry.snapshotId}
            rubric={entry.rubric}
            initialScores={entry.evaluation?.scores ?? {}}
            initialComment={entry.evaluation?.privateComment ?? null}
            expectedVersion={entry.evaluation?.expectedVersion ?? 0}
            status={entry.evaluation?.status ?? null}
            scoringSessionOpen={entry.scoringSessionOpen}
          />
        ) : (
          <section className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="text-sm text-fr-muted">
              La puntuación estará disponible cuando el organizador abra una sesión de jurado con
              rúbrica activa (LIVE deshabilitado por defecto).
            </p>
          </section>
        )}

        <section className="fr-recuadro space-y-4 border border-fr-border bg-fr-card">
          <h2 className="text-lg font-semibold text-fr-primary">Resumen técnico</h2>
          <p className="text-sm text-fr-muted">{entry.technical.evaluationMessage}</p>
          <ul className="space-y-2 text-sm text-fr-primary">
            <li>Estado: {entry.technical.technicalSummaryStatus}</li>
            <li>
              Dimensiones: {entry.technical.width ?? "—"} × {entry.technical.height ?? "—"}
            </li>
            <li>
              EXIF:{" "}
              {entry.technical.exifAvailable ? "disponible (parcial o completo)" : "no disponible"}
            </li>
            <li>Advertencias: {entry.technical.warningCount}</li>
          </ul>
        </section>

        <section className="fr-recuadro space-y-4 border border-fr-border bg-fr-card">
          <h2 className="text-lg font-semibold text-fr-primary">Conflicto de interés</h2>
          <p className="text-sm text-fr-muted">
            Si reconocés a la persona o tenés un conflicto, declaralo. No se te revelará la identidad.
          </p>
          <JuryConflictForm contestId={contestId} entryId={entryId} />
        </section>
      </div>
    </div>
  );
}
