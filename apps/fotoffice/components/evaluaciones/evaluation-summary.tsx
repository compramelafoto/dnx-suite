import type { MockStudent } from "./types";

type EvaluationSummaryProps = {
  student: MockStudent | null;
  score: number;
  maxScore: number;
  feedback: string;
  progressLabel: string;
  remainingCriteria: number;
  readyToReview: boolean;
  canMarkReviewed: boolean;
  reviewed: boolean;
  onCopyFeedback: () => void;
  onMarkReviewed: () => void;
  onClearStudentCorrection: () => void;
};

export function EvaluationSummary({
  student,
  score,
  maxScore,
  feedback,
  progressLabel,
  remainingCriteria,
  readyToReview,
  canMarkReviewed,
  reviewed,
  onCopyFeedback,
  onMarkReviewed,
  onClearStudentCorrection,
}: EvaluationSummaryProps) {
  return (
    <section className="fo-card space-y-4 p-4 md:p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Resumen</p>
          <h3 className="text-base font-semibold text-[var(--fo-text)]">{student?.fullName ?? "Sin alumno"}</h3>
        </div>
        <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] px-3 py-1.5">
          <p className="text-xs text-[var(--fo-muted)]">Score</p>
          <p className="text-sm font-semibold text-[var(--fo-text)]">
            {score}/{maxScore}
          </p>
        </div>
      </header>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted-soft)]">Devolución base</p>
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-3 text-sm text-[var(--fo-text-secondary)] leading-relaxed whitespace-pre-wrap">
          {feedback || "Seleccioná niveles para generar la devolución automática."}
        </p>
      </div>
      <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-3 py-2 text-xs text-[var(--fo-muted)]">
        <p>{progressLabel}</p>
        <p>{readyToReview ? "Listo para revisar" : `Faltan ${remainingCriteria} criterios`}</p>
      </div>
      <div className="fo-form-actions mt-0 border-t-0 pt-0">
        <button type="button" className="fo-btn fo-btn-secondary text-sm min-h-9" onClick={onCopyFeedback}>
          Copiar devolución
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm min-h-9"
          onClick={onMarkReviewed}
          disabled={!canMarkReviewed}
        >
          {reviewed ? "Revisado" : "Marcar como revisado"}
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-danger-outline text-sm min-h-9"
          onClick={onClearStudentCorrection}
        >
          Limpiar corrección
        </button>
      </div>
    </section>
  );
}
