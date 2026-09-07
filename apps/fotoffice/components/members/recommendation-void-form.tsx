"use client";

import { useActionState } from "react";
import {
  voidRecommendationBenefitAction,
  type RecommendationActionState,
} from "@/app/actions/recommendations";

const initial: RecommendationActionState = { error: null, ok: null };

/**
 * Anular una bonificación, con el motivo a la vista.
 *
 * El motivo no es un campo opcional escondido: una cuota que vuelve a costar lo que costaba
 * necesita una explicación escrita, o el socio recibe un aumento sin razón visible.
 */
export function RecommendationVoidForm({
  benefitId,
  memberId,
}: {
  benefitId: string;
  memberId: string;
}) {
  const [state, submit, pending] = useActionState(voidRecommendationBenefitAction, initial);

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="benefitId" value={benefitId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input
        name="reason"
        placeholder="Motivo de la anulación"
        required
        className="fo-input flex-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="fo-btn fo-btn-secondary text-xs disabled:opacity-60"
      >
        {pending ? "Anulando…" : "Anular"}
      </button>
      {state.error ? (
        <p className="w-full text-xs text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="w-full text-xs text-[var(--fo-success)]">{state.ok}</p> : null}
    </form>
  );
}
