"use client";

/**
 * Control de cambio de fase. Sin confirmación explícita no cambia nada, y el
 * servidor vuelve a validar los gates: este panel no es la única defensa.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { transitionContestPhaseAction } from "../../../../../actions/contest-lifecycle";
import {
  CONTEST_LIFECYCLE_LABELS,
  type ContestLifecyclePhase,
} from "../../../../../lib/fotorank/upcoming/lifecycle";

export type PhaseTransitionPanelProps = {
  contestId: string;
  currentStatus: string;
  /** Fases a las que se puede intentar avanzar desde el estado actual. */
  targets: ContestLifecyclePhase[];
};

export function PhaseTransitionPanel({
  contestId,
  currentStatus,
  targets,
}: PhaseTransitionPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<ContestLifecyclePhase | null>(null);

  function run(target: ContestLifecyclePhase) {
    startTransition(async () => {
      const result = await transitionContestPhaseAction({ contestId, target });
      if (!result.ok) {
        setMessage(result.error);
        setMissing(result.missing ?? []);
        setConfirming(null);
        return;
      }
      setMessage(
        `Fase actualizada: ${CONTEST_LIFECYCLE_LABELS[result.to] ?? result.to}.`,
      );
      setMissing([]);
      setConfirming(null);
      router.refresh();
    });
  }

  if (targets.length === 0) {
    return (
      <p className="text-sm text-fr-muted">
        No hay transiciones disponibles desde el estado actual ({currentStatus}).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fr-muted">
        El cambio de fase es una acción administrativa explícita. Nunca ocurre de forma automática
        ni programada.
      </p>

      <div className="flex flex-wrap gap-3">
        {targets.map((t) => (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => setConfirming(t)}
            className="fr-btn fr-btn-secondary inline-flex w-fit disabled:opacity-50"
            data-testid={`transition-to-${t}`}
          >
            Pasar a {CONTEST_LIFECYCLE_LABELS[t]}
          </button>
        ))}
      </div>

      {confirming ? (
        <div className="space-y-3 border border-[#7a2e2e] bg-[#1a0d0d] p-4">
          <p className="text-sm text-[#e6b8b8]">
            ¿Confirmás el pase a <strong>{CONTEST_LIFECYCLE_LABELS[confirming]}</strong>? Esta acción
            queda registrada en la auditoría.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(confirming)}
              className="fr-btn fr-btn-primary inline-flex w-fit disabled:opacity-50"
            >
              {pending ? "Aplicando…" : "Confirmar"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(null)}
              className="fr-btn fr-btn-secondary inline-flex w-fit disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-fr-primary">{message}</p> : null}

      {missing.length > 0 ? (
        <ul className="space-y-1 text-sm text-[#e07a7a]">
          {missing.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
