"use client";

export interface ContestWizardStepDefinition {
  id: number;
  label: string;
}

interface ContestWizardStepperPremiumProps {
  steps: readonly ContestWizardStepDefinition[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  /** Máximo paso alcanzado en el flujo (no se puede saltar hacia adelante) */
  maxStepReached?: number;
}

/**
 * Stepper horizontal: línea con progreso dorado, círculos y labels.
 */
export function ContestWizardStepperPremium({
  steps,
  currentStep,
  onStepClick,
  maxStepReached = steps.length,
}: ContestWizardStepperPremiumProps) {
  const n = steps.length;
  const linePct =
    n <= 1 ? 0 : Math.min(100, (currentStep / Math.max(1, n - 1)) * 100);

  return (
    <nav className="mt-2 mb-36 sm:mb-48" aria-label="Pasos del asistente de creación de concurso">
      <div className="relative px-2 sm:px-4">
        <div
          className="pointer-events-none absolute left-[10%] right-[10%] top-[1.25rem] z-0 h-0.5 overflow-hidden rounded-full bg-zinc-800 sm:top-[1.375rem]"
          aria-hidden
        >
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 transition-[width] duration-500 ease-out"
            style={{ width: `${linePct}%` }}
          />
        </div>

        <ol className="relative z-[1] flex justify-between gap-2 sm:gap-4">
          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isDone = step.id < currentStep;
            const canNavigate = step.id <= maxStepReached;

            return (
              <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (canNavigate) onStepClick?.(step.id);
                  }}
                  disabled={!canNavigate}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${step.label}, paso ${step.id} de ${n}${!canNavigate ? " (no disponible aún)" : ""}`}
                  className="group flex w-full flex-col items-center gap-4 rounded-2xl py-2 sm:gap-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 sm:h-11 sm:w-11",
                      isActive
                        ? "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-black shadow-[0_0_0_2px_rgba(212,175,55,0.25),0_6px_20px_rgba(212,175,55,0.2)]"
                        : isDone
                          ? "border border-amber-500/40 bg-zinc-900/90 text-amber-400"
                          : "border border-zinc-600 bg-[#0f0f12] text-zinc-500",
                    ].join(" ")}
                  >
                    {step.id}
                  </span>
                  <span
                    className={[
                      "max-w-[5.5rem] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:text-xs",
                      isActive ? "text-amber-400" : isDone ? "text-zinc-400" : "text-zinc-500",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
