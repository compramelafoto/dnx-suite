import { Check, Lock } from "lucide-react";
import type { ParticipantProgressStep } from "../../lib/fotorank/participant-experience";

type Props = {
  steps: ParticipantProgressStep[];
  compact?: boolean;
  /** Texto bajo cada etapa ("Listo", "Ahora", "Abre el 12 nov."…). */
  hints?: Partial<Record<ParticipantProgressStep["key"], string>>;
};

const STATE_SR: Record<ParticipantProgressStep["state"], string> = {
  completed: "completada",
  current: "etapa actual",
  upcoming: "pendiente",
  locked: "bloqueada",
  na: "",
};

/**
 * Etapas del concurso como una línea numerada: cada etapa dice si está lista,
 * si es la actual o cuándo empieza. La actual se destaca en dorado.
 */
export function ParticipantProgress({ steps, compact = false, hints }: Props) {
  if (steps.length === 0) return null;

  return (
    <ol
      className={["fr-pp-steps", compact && "fr-pp-steps--compact"].filter(Boolean).join(" ")}
      aria-label="Etapas de tu participación"
    >
      {steps.map((step, i) => (
        <li
          key={step.key}
          className={`fr-pp-step fr-pp-step--${step.state}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className="fr-pp-step__marker" aria-hidden>
            {step.state === "completed" ? (
              <Check width={14} height={14} strokeWidth={3} />
            ) : step.state === "locked" ? (
              <Lock width={12} height={12} strokeWidth={2.5} />
            ) : (
              i + 1
            )}
          </span>
          <span className="fr-pp-step__text">
            <span className="fr-pp-step__label">{step.label}</span>
            {hints?.[step.key] ? <span className="fr-pp-step__hint">{hints[step.key]}</span> : null}
          </span>
          <span className="sr-only">{STATE_SR[step.state]}</span>
        </li>
      ))}
    </ol>
  );
}
