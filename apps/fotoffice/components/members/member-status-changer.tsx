"use client";

import { useActionState } from "react";
import { changeMemberStatusAction, type ChangeStatusState } from "@/app/actions/members";
import { MEMBER_STATUS_OPTIONS } from "@/lib/members/status-labels";

const initial: ChangeStatusState = { error: null };

export function MemberStatusChanger({
  memberId,
  status,
}: {
  memberId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(changeMemberStatusAction, initial);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={memberId} />
      <select
        key={status}
        name="status"
        defaultValue={status}
        disabled={pending}
        className="fo-input !min-h-9 !py-1 text-sm"
        aria-label="Cambiar estado del socio"
      >
        {MEMBER_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" className="fo-btn fo-btn-secondary text-xs min-h-9 px-3" disabled={pending}>
        {pending ? "…" : "Cambiar"}
      </button>
      {state.error ? <span className="text-xs text-[var(--fo-danger)]">{state.error}</span> : null}
    </form>
  );
}
