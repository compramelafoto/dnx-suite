"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type AcceptInvitationState } from "@/app/actions/accept-invitation";

const initial: AcceptInvitationState = { error: null };

export function AcceptInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
        {pending ? "Vinculando…" : "Confirmar y vincular mi cuenta"}
      </button>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
    </form>
  );
}
