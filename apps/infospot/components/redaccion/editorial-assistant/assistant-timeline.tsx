"use client";

import type { AssistantStepId } from "@/lib/editorial-assistant";
import { timelineForIntent, type TimelineItem } from "@/lib/editorial-assistant";

type Props = {
  intent: Parameters<typeof timelineForIntent>[0];
  current: AssistantStepId;
  onJump?: (step: AssistantStepId) => void;
};

function statusFor(
  steps: TimelineItem[],
  current: AssistantStepId,
  id: AssistantStepId,
): "done" | "current" | "upcoming" {
  const cur = steps.findIndex((s) => s.id === current);
  const idx = steps.findIndex((s) => s.id === id);
  if (idx < 0) return "upcoming";
  if (idx < cur) return "done";
  if (idx === cur) return "current";
  return "upcoming";
}

/**
 * Timeline del asistente (siempre visible).
 * Guía periodística — no wizard técnico.
 */
export function AssistantTimeline({ intent, current, onJump }: Props) {
  const steps = timelineForIntent(intent);
  const currentIdx = steps.findIndex((s) => s.id === current);
  const nearWrite =
    current === "summary" ||
    current === "draft" ||
    (currentIdx >= 0 && currentIdx >= steps.length - 2);

  return (
    <nav aria-label="Progreso del asistente" className="w-full">
      <p className="is-editorial-section-label mb-4">Tu camino</p>
      <ol className="is-timeline">
        {steps.map((step) => {
          const status = statusFor(steps, current, step.id);
          const canJump = status === "done" && onJump;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump?.(step.id)}
                className={`is-timeline-step is-timeline-step--${status}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span className="is-timeline-mark" aria-hidden>
                  {status === "done" || status === "current" ? "✓" : ""}
                </span>
                <span>{step.label}</span>
                <span className="sr-only">
                  {status === "done"
                    ? "completado"
                    : status === "current"
                      ? "paso actual"
                      : "pendiente"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {nearWrite ? (
        <p className="is-timeline-footer" role="note">
          Ahora escribí tu historia.
        </p>
      ) : null}
    </nav>
  );
}
