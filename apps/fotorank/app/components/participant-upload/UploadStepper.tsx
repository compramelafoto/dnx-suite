import { UPLOAD_WIZARD_STEPS, type UploadWizardStepId } from "../../lib/fotorank/participant-upload";

type Props = {
  current: UploadWizardStepId;
};

export function UploadStepper({ current }: Props) {
  const currentIndex = UPLOAD_WIZARD_STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="fr-upload-stepper" aria-label="Pasos de carga">
      {UPLOAD_WIZARD_STEPS.map((step, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            className={`fr-upload-stepper__item fr-upload-stepper__item--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="fr-upload-stepper__num" aria-hidden>
              {step.shortLabel}
            </span>
            <span className="fr-upload-stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
