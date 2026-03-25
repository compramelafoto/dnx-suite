"use client";

import { Check } from "lucide-react";

export interface WizardStepDefinition {
  id: number;
  label: string;
  sublabel: string;
}

interface WizardStepperProps {
  steps: readonly WizardStepDefinition[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

/**
 * Progreso + pasos alineados al sistema FotoRank (sin zinc ni doble estética).
 */
export function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
  const total = steps.length;
  const pct = total <= 1 ? 0 : ((currentStep - 1) / (total - 1)) * 100;

  return (
    <div className="mb-8 md:mb-9" role="navigation" aria-label="Etapas del asistente">
      <div className="relative mb-4 h-8">
        <div className="absolute left-4 right-4 top-4 h-px bg-[#2a2a2a]" aria-hidden />
        <div
          className="absolute left-4 top-4 h-px bg-gold transition-[width] duration-500 ease-out"
          style={{ width: `calc((100% - 2rem) * ${pct / 100})` }}
          aria-hidden
        />
      </div>

      <ol className="flex justify-between gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const n = index + 1;

          return (
            <li key={step.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onStepClick?.(step.id)}
                className="flex w-full flex-col items-center gap-2 rounded-lg py-1.5 transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"
              >
                <span
                  className={[
                    "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all sm:h-9 sm:w-9",
                    isActive
                      ? "border-gold bg-gold text-[#050505] shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
                      : isCompleted
                        ? "border-gold/70 bg-[#121212] text-gold"
                        : "border-[#2a2a2a] bg-[#121212] text-fr-muted-soft",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  ) : (
                    n
                  )}
                </span>
                <span className="w-full px-0.5 text-center">
                  <span
                    className={[
                      "block text-[11px] font-medium leading-tight sm:text-[0.95rem]",
                      isActive ? "text-gold" : isCompleted ? "text-fr-primary" : "text-fr-muted-soft",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
