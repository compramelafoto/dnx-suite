"use client";

import { useActionState, useState } from "react";
import { changeMemberStatusAction, type ChangeStatusState } from "@/app/actions/members";
import { MEMBER_STATUS_LABELS, MEMBER_STATUS_OPTIONS, isMemberStatus } from "@/lib/members/status-labels";
import { statusRequiresReason } from "@/lib/members/audit";

const initial: ChangeStatusState = { error: null };

export function MemberStatusChanger({
  memberId,
  status,
}: {
  memberId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(changeMemberStatusAction, initial);
  const [selected, setSelected] = useState(status);

  const changed = selected !== status;
  const needsReason = isMemberStatus(selected) && statusRequiresReason(selected);
  // Confirmación en la misma pantalla, sin window.confirm: el administrador ve qué va a pasar
  // y escribe el motivo antes de ejecutar, no después.
  const confirming = changed && needsReason;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={memberId} />
      <div className="inline-flex items-center gap-2">
        <select
          key={status}
          name="status"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
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
        <button
          type="submit"
          className="fo-btn fo-btn-secondary text-xs min-h-9 px-3"
          disabled={pending || !changed}
        >
          {pending ? "…" : "Cambiar"}
        </button>
      </div>

      {confirming ? (
        <div className="fo-card space-y-2 border-[var(--fo-danger)]/40 p-3">
          <p className="text-xs text-[var(--fo-text)]">
            Vas a marcar a este socio como{" "}
            <strong>{MEMBER_STATUS_LABELS[selected as keyof typeof MEMBER_STATUS_LABELS]}</strong>. Queda
            registrado en su historial junto con tu nombre y la fecha.
          </p>
          <label className="fo-label text-xs" htmlFor="reason">
            Motivo (obligatorio)
          </label>
          <input
            id="reason"
            name="reason"
            required
            maxLength={500}
            placeholder="Ej. Cuota impaga desde marzo"
            className="fo-input !min-h-9 !py-1 text-sm"
          />
        </div>
      ) : null}

      {changed && !needsReason ? (
        <input type="hidden" name="reason" value="" />
      ) : null}

      {state.error ? <span className="text-xs text-[var(--fo-danger)]">{state.error}</span> : null}
    </form>
  );
}
