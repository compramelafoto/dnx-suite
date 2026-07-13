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
 * Sustituye “Paso X de Y” por una guía periodística.
 */
export function AssistantTimeline({ intent, current, onJump }: Props) {
  const steps = timelineForIntent(intent);

  return (
    <nav aria-label="Progreso del asistente" className="w-full">
      <ol className="flex flex-col gap-2 sm:gap-3">
        {steps.map((step) => {
          const status = statusFor(steps, current, step.id);
          const canJump = status === "done" && onJump;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump?.(step.id)}
                className={`flex w-full items-center gap-3 rounded-[var(--is-radius-sm)] px-2 py-2 text-left text-sm transition duration-200 ${
                  status === "current"
                    ? "bg-[var(--is-accent)]/10 font-semibold text-[var(--is-text)]"
                    : status === "done"
                      ? "text-[var(--is-text)] hover:bg-[var(--is-bg-muted)]"
                      : "text-[var(--is-muted)]"
                } ${canJump ? "cursor-pointer" : "cursor-default"}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span
                  className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                    status === "current"
                      ? "border-[var(--is-accent)] bg-[var(--is-accent)] text-white"
                      : status === "done"
                        ? "border-[var(--is-accent)] bg-[var(--is-accent)] text-white"
                        : "border-[var(--is-border)] bg-transparent text-transparent"
                  }`}
                  aria-hidden
                >
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
    </nav>
  );
}
