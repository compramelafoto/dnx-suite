"use client";

/**
 * Botón "Notificarme" con su modal de confirmación.
 *
 * Sin sesión: lleva a iniciar sesión conservando el concurso de origen para
 * volver acá. El interés NO se marca hasta que haya consentimiento explícito.
 *
 * Con sesión: un clic abre el modal; confirmar registra el interés. Repetir la
 * acción es inofensivo — el servidor es idempotente.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  CONSENT_TEXTS,
  INTEREST_MODAL_COPY,
  renderConsentText,
  renderModalTitle,
} from "../../lib/fotorank/upcoming/consent";
import {
  cancelContestInterestAction,
  registerContestInterestAction,
} from "../../actions/contest-interest";

type InterestState = { status: "ACTIVE" | "CANCELLED" | "CONVERTED"; benefitEligible: boolean } | null;

export type NotifyMeButtonProps = {
  contestId: string;
  slug: string;
  contestTitle: string;
  initialInterest: InterestState;
  /** Si viene con texto, el botón se muestra pero no ejecuta nada. */
  disabledReason?: string | null;
};

export function NotifyMeButton({
  contestId,
  slug,
  contestTitle,
  initialInterest,
  disabledReason = null,
}: NotifyMeButtonProps) {
  const router = useRouter();
  const [interest, setInterest] = useState<InterestState>(initialInterest);
  const [open, setOpen] = useState(false);
  const [generalOptIn, setGeneralOptIn] = useState(false); // nunca premarcado
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isRegistered = interest?.status === "ACTIVE" || interest?.status === "CONVERTED";

  function handleOpen() {
    if (disabledReason) {
      setFeedback(disabledReason);
      return;
    }
    setError(null);
    setFeedback(null);
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await registerContestInterestAction({
        contestId,
        slug,
        // El consentimiento específico es la condición del propio botón.
        contestSpecificOptIn: true,
        generalOptIn,
        source: "PUBLIC_CARD",
      });

      if (!result.ok) {
        if (result.requiresLogin) {
          // Conserva el concurso de origen para volver después de autenticarse.
          const next = `/concursos/${slug}?notificarme=1`;
          router.push(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setError(result.error);
        return;
      }

      setInterest({ status: "ACTIVE", benefitEligible: result.benefitEligible });
      setFeedback(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  function handleCancel() {
    if (disabledReason) {
      setFeedback(disabledReason);
      return;
    }
    startTransition(async () => {
      const result = await cancelContestInterestAction({ contestId, slug });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInterest({ status: "CANCELLED", benefitEligible: false });
      setFeedback(result.message);
      router.refresh();
    });
  }

  if (isRegistered) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gold" data-testid="interest-registered">
          Ya estás en la lista. Te avisaremos cuando abra el concurso.
        </p>
        {feedback ? <p className="text-sm text-[#a1a1a1]">{feedback}</p> : null}
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="text-xs underline underline-offset-4 text-[#a1a1a1] hover:text-fr-primary disabled:opacity-50"
          data-testid="cancel-interest"
        >
          Cancelar los avisos de este concurso
        </button>
        {error ? <p className="text-sm text-[#e07a7a]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleOpen}
        disabled={pending}
        data-testid="notify-me-button"
        className="w-full rounded-sm bg-gold px-6 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:opacity-90 disabled:opacity-50"
      >
        Notificarme
      </button>

      {feedback ? (
        <p className="text-sm text-[#a1a1a1]" data-testid="interest-feedback">
          {feedback}
        </p>
      ) : null}
      {error ? <p className="text-sm text-[#e07a7a]">{error}</p> : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={renderModalTitle(contestTitle)}
          data-testid="notify-me-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-lg space-y-6 border border-fr-border bg-fr-card p-7">
            <h4 className="font-sans text-xl font-semibold text-fr-primary">
              {renderModalTitle(contestTitle)}
            </h4>

            <p className="text-sm leading-relaxed text-[#a1a1a1]">{INTEREST_MODAL_COPY.body}</p>

            <div className="space-y-4 border-t border-fr-border pt-5">
              {/* Consentimiento específico: informado y obligatorio, implícito en el botón. */}
              <p className="text-xs leading-relaxed text-[#8a8a8a]">
                {renderConsentText("CONTEST_SPECIFIC", contestTitle)}
              </p>

              {/* Consentimiento general: opcional, independiente y sin premarcar. */}
              <label className="flex items-start gap-3 text-xs leading-relaxed text-[#8a8a8a]">
                <input
                  type="checkbox"
                  checked={generalOptIn}
                  onChange={(e) => setGeneralOptIn(e.target.checked)}
                  className="mt-0.5"
                  data-testid="general-opt-in"
                />
                <span>{CONSENT_TEXTS.GENERAL.template}</span>
              </label>
            </div>

            {error ? <p className="text-sm text-[#e07a7a]">{error}</p> : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                data-testid="confirm-interest"
                className="rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              >
                {pending ? "Registrando…" : INTEREST_MODAL_COPY.confirmLabel}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-sm border border-fr-border px-5 py-2.5 text-sm text-[#a1a1a1] disabled:opacity-50"
              >
                {INTEREST_MODAL_COPY.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
