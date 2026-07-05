"use client";

import WizardStepStatusIcon from "@/components/cuantocobro/WizardStepStatusIcon";
import { getCuantoCobroStepValidationStatus } from "@/lib/cuantocobro/step-validation";
import {
  CC_DATA_SECURITY_NOTICE,
  CC_WIZARD_STEPS,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
  type CuantoCobroWizardBlock,
} from "@/lib/cuantocobro/types";

type Props = {
  stepIndex: number;
  progress: number;
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
  onStepSelect: (index: number) => void;
};

const BLOCK_ORDER: CuantoCobroWizardBlock[] = ["profile", "quote"];

export default function CuantoCobroWizardSidebar({
  stepIndex,
  progress,
  profile,
  quote,
  onStepSelect,
}: Props) {
  return (
    <aside className="cc-wizard-sidebar" aria-label="Pasos del cálculo">
      <div className="cc-wizard-sidebar__progress">
        <div className="cc-wizard-sidebar__progress-meta">
          <span className="cc-wizard-sidebar__progress-label">Progreso general</span>
          <span className="cc-wizard-sidebar__progress-value">
            Paso {stepIndex + 1} de {CC_WIZARD_STEPS.length}
          </span>
        </div>
        <div
          className="cc-progress-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="cc-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <nav className="cc-wizard-sidebar__nav">
        {BLOCK_ORDER.map((block) => {
          const blockSteps = CC_WIZARD_STEPS.map((step, index) => ({ step, index })).filter(
            ({ step }) => step.block === block,
          );

          return (
            <div key={block} className={`cc-wizard-sidebar__block cc-wizard-sidebar__block--${block}`}>
              <p className="cc-wizard-sidebar__block-title">{blockSteps[0]?.step.blockTitle}</p>
              <ul className="cc-wizard-sidebar__steps">
                {blockSteps.map(({ step, index }) => {
                  const isCurrent = index === stepIndex;
                  const validationStatus = getCuantoCobroStepValidationStatus(step.id, profile, quote);

                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        className={[
                          "cc-wizard-step-item",
                          isCurrent ? "cc-wizard-step-item--current" : "",
                          `cc-wizard-step-item--validation-${validationStatus}`,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => onStepSelect(index)}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        <span className="cc-wizard-step-item__indicator" aria-hidden>
                          <WizardStepStatusIcon status={validationStatus} />
                        </span>
                        <span className="cc-wizard-step-item__content">
                          <span className="cc-wizard-step-item__title">{step.title}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <p className="cc-wizard-sidebar__security">{CC_DATA_SECURITY_NOTICE}</p>
    </aside>
  );
}
