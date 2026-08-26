import type { ParticipantProgressStep } from "../../lib/fotorank/participant-experience";

type Props = {
  steps: ParticipantProgressStep[];
  compact?: boolean;
};

export function ParticipantProgress({ steps, compact = false }: Props) {
  if (steps.length === 0) return null;

  return (
    <ol
      className={[
        "fr-participant-progress",
        compact && "fr-participant-progress--compact",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Progreso de la participación"
    >
      {steps.map((step) => (
        <li
          key={step.key}
          className={`fr-participant-progress__step fr-participant-progress__step--${step.state}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className="fr-participant-progress__dot" aria-hidden />
          <span className="fr-participant-progress__label">{step.label}</span>
          <span className="sr-only">
            {step.state === "completed"
              ? "completada"
              : step.state === "current"
                ? "actual"
                : step.state === "locked"
                  ? "bloqueada"
                  : "pendiente"}
          </span>
        </li>
      ))}
    </ol>
  );
}
