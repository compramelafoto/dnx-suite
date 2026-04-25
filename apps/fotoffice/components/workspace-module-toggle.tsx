"use client";

import { useActionState } from "react";
import {
  toggleCoursesSalesModuleAction,
  type ToggleModuleState,
} from "@/app/actions/courses-sales-admin";

const initial: ToggleModuleState = { error: null };

export function WorkspaceModuleToggle({
  workspaceId,
  enabled,
  disabled = false,
}: {
  workspaceId: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(toggleCoursesSalesModuleAction, initial);

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending || disabled}
        className={
          enabled
            ? "fo-btn fo-btn-danger-outline text-xs min-h-9 px-3"
            : "fo-btn fo-btn-primary text-xs min-h-9 px-3"
        }
      >
        {pending ? "…" : enabled ? "Desactivar" : "Activar"}
      </button>
      {state.error ? (
        <span className="text-xs text-[var(--fo-danger)] max-w-[12rem] text-right">{state.error}</span>
      ) : null}
    </form>
  );
}
