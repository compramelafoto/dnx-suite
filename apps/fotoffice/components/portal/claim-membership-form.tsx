"use client";

import { useActionState } from "react";
import { claimMembershipAction, type ClaimState } from "@/app/actions/claim-membership";

const initial: ClaimState = { error: null };

export function ClaimMembershipForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(claimMembershipAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="memberId" value={memberId} />
      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary w-full">
        {pending ? "Vinculando…" : "Sí, soy yo"}
      </button>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
    </form>
  );
}
