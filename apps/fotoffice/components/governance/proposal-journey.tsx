import { Check, X } from "lucide-react";
import type { JourneyStep } from "@/lib/governance/proposals";

/**
 * La línea de avance de una propuesta: cinco puntos unidos, del envío a la realización. Lo hecho
 * en verde con tilde, el paso actual resaltado, el corte en rojo con cruz. En el teléfono se
 * nombra sólo el paso actual; en pantallas anchas, todos.
 */
export function ProposalJourney({ steps }: { steps: JourneyStep[] }) {
  // Todo hecho: se nombra el último paso ("Realizada").
  const actual = steps.find((s) => s.state === "current" || s.state === "failed") ?? (steps.every((s) => s.state === "done") ? steps.at(-1) : undefined);
  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-5" aria-label="En qué paso está">
        {steps.map((s, i) => {
          const punto =
            s.state === "done"
              ? "border-[var(--fo-success)] bg-[var(--fo-success)] text-white"
              : s.state === "failed"
                ? "border-[var(--fo-danger)] bg-[var(--fo-danger)] text-white"
                : s.state === "current"
                  ? "border-[var(--fo-accent)] bg-[var(--fo-surface)] text-[var(--fo-accent)] ring-4 ring-[var(--fo-accent-muted)]"
                  : "border-[var(--fo-border-strong)] bg-[var(--fo-surface)] text-[var(--fo-muted-soft)]";
          const siguiente = steps[i + 1]?.state;
          const tramo =
            siguiente === "failed" ? "bg-[var(--fo-danger)]" : siguiente && siguiente !== "pending" ? "bg-[var(--fo-success)]" : "bg-[var(--fo-border)]";
          return (
            <li key={s.key} className="relative flex flex-col items-center gap-1.5 text-center">
              {i < steps.length - 1 ? (
                <span
                  className={`absolute left-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${tramo}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${punto}`}
                aria-hidden
              >
                {s.state === "done" ? (
                  <Check className="size-3.5" strokeWidth={3.5} />
                ) : s.state === "failed" ? (
                  <X className="size-3.5" strokeWidth={3.5} />
                ) : s.state === "current" ? (
                  <span className="size-2 rounded-full bg-[var(--fo-accent)]" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden px-1 text-[11px] leading-tight sm:block ${
                  s.state === "failed"
                    ? "font-semibold text-[var(--fo-danger)]"
                    : s.state === "current"
                      ? "font-semibold text-[var(--fo-text)]"
                      : s.state === "done"
                        ? "text-[var(--fo-text-secondary)]"
                        : "text-[var(--fo-muted-soft)]"
                }`}
              >
                <span className="sr-only">
                  {s.state === "done" ? "Hecho: " : s.state === "failed" ? "Se cortó acá: " : s.state === "current" ? "Ahora: " : "Falta: "}
                </span>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {actual ? (
        <p className={`text-xs font-semibold sm:hidden ${actual.state === "failed" ? "text-[var(--fo-danger)]" : actual.state === "done" ? "text-[var(--fo-success)]" : "text-[var(--fo-text)]"}`}>
          {actual.label}
        </p>
      ) : null}
    </div>
  );
}
