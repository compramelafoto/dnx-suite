"use client";

import WizardStepStatusIcon from "@/components/cuantocobro/WizardStepStatusIcon";
import { getCuantoCobroStepValidationStatus } from "@/lib/cuantocobro/step-validation";
import { CC_WIZARD_STEPS, type CuantoCobroProfileInput, type CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";

type Props = {
  stepIndex: number;
  progress: number;
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
  onStepSelect: (index: number) => void;
};

export default function CuantoCobroWizardMobileNav({
  stepIndex,
  progress,
  profile,
  quote,
  onStepSelect,
}: Props) {
  const currentStep = CC_WIZARD_STEPS[stepIndex];

  return (
    <div className="cc-wizard-mobile-nav" aria-label="Progreso del cálculo">
      <div className="cc-wizard-mobile-nav__header">
        <p className="cc-wizard-mobile-nav__eyebrow">
          Paso {stepIndex + 1} de {CC_WIZARD_STEPS.length} · {currentStep.blockTitle}
        </p>
        <h3 className="cc-wizard-mobile-nav__title">{currentStep.title}</h3>
      </div>

      <div
        className="cc-progress-track"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso: ${Math.round(progress)}%`}
      >
        <div className="cc-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="cc-wizard-mobile-nav__chips" role="tablist" aria-label="Seleccionar paso">
        {CC_WIZARD_STEPS.map((step, index) => {
          const isCurrent = index === stepIndex;
          const validationStatus = getCuantoCobroStepValidationStatus(step.id, profile, quote);

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-current={isCurrent ? "step" : undefined}
              className={[
                "cc-wizard-mobile-chip",
                isCurrent ? "cc-wizard-mobile-chip--current" : "",
                `cc-wizard-mobile-chip--validation-${validationStatus}`,
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onStepSelect(index)}
            >
              <span className="cc-wizard-mobile-chip__indicator">
                <WizardStepStatusIcon status={validationStatus} />
              </span>
              <span className="cc-wizard-mobile-chip__label">{step.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
