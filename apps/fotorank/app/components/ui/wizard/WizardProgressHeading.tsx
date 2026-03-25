"use client";

export type WizardAutoSaveState = "idle" | "saving" | "saved" | "error";

export interface WizardProgressHeadingProps {
  currentStep: number;
  totalSteps: number;
  headline: string;
  intro: string;
  draftSaved?: boolean;
  hasContestId?: boolean;
  autoSaveState?: WizardAutoSaveState;
}

/**
 * Título del paso + intro. El número de paso no se repite en texto (ya lo muestra el stepper).
 */
export function WizardProgressHeading({
  currentStep,
  totalSteps,
  headline,
  intro,
  draftSaved,
  hasContestId,
  autoSaveState = "idle",
}: WizardProgressHeadingProps) {
  const statusLabel = (() => {
    if (autoSaveState === "saving") return "Guardando borrador…";
    if (autoSaveState === "error") return "Error al guardar";
    if (draftSaved || autoSaveState === "saved") return "Guardado";
    if (hasContestId) return "Autoguardado";
    return "Se crea el borrador al avanzar";
  })();

  const statusMuted =
    autoSaveState === "error"
      ? "text-red-400/90"
      : autoSaveState === "saving" || draftSaved || autoSaveState === "saved"
        ? "text-fr-muted"
        : "text-fr-muted-soft";

  return (
    <header className="space-y-2.5 md:space-y-3">
      <span className="sr-only">
        Paso {currentStep} de {totalSteps}
      </span>

      <h1 className="font-sans text-[2rem] font-semibold leading-tight tracking-tight text-fr-primary md:text-[2.2rem]">
        {headline}
      </h1>
      <p className="max-w-2xl text-[1.02rem] leading-relaxed text-fr-muted">{intro}</p>
      <p className={`flex items-center gap-2 text-[11px] font-medium ${statusMuted}`}>
        {autoSaveState === "saving" ? (
          <span
            className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-fr-muted-soft border-t-transparent"
            aria-hidden
          />
        ) : (draftSaved || autoSaveState === "saved") && autoSaveState !== "error" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90" aria-hidden />
        ) : null}
        {statusLabel}
      </p>
    </header>
  );
}
