"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  inviteTestimonialsAction,
  type InviteState,
} from "@/lib/testimonials/admin/invite-action";

const initialState: InviteState = { ok: false };

export function InviteTestimonialsButton({
  editionId,
  editionName,
}: {
  editionId: string;
  editionName: string;
}) {
  const [state, action, pending] = useActionState(
    inviteTestimonialsAction,
    initialState,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Invitando…" : `Invitar · ${editionName}`}
      </Button>
      {state.message ? (
        <span
          role="status"
          className={
            state.ok
              ? "text-sm text-[var(--ck-success)]"
              : "text-sm text-[var(--ck-danger)]"
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
