"use client";

import { useActionState } from "react";
import { setModuleFeeAction, type PlatformFeeState } from "@/app/actions/platform-fee-admin";

const initial: PlatformFeeState = { error: null, ok: null };

/**
 * Edición de la comisión de la plataforma para un módulo de un workspace.
 *
 * Solo se renderiza en el panel de super admin. La acción vuelve a verificar el permiso:
 * esconder el campo no es un control de acceso.
 */
export function WorkspaceModuleFeeField({
  workspaceId,
  moduleKey,
  feeBps,
}: {
  workspaceId: string;
  moduleKey: string;
  feeBps: number;
}) {
  const [state, action, pending] = useActionState(setModuleFeeAction, initial);
  const defaultPercent = (feeBps / 100).toString().replace(".", ",");

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="moduleKey" value={moduleKey} />
      <div className="flex items-center gap-2">
        <label
          className="text-xs text-[var(--fo-muted)]"
          htmlFor={`fee-${moduleKey}`}
        >
          Comisión
        </label>
        <input
          id={`fee-${moduleKey}`}
          type="text"
          name="feePercent"
          defaultValue={defaultPercent}
          inputMode="decimal"
          className="fo-input w-20 text-sm"
        />
        <span className="text-xs text-[var(--fo-muted)]">%</span>
        <button type="submit" disabled={pending} className="fo-btn text-xs min-h-9 px-3">
          {pending ? "…" : "Guardar"}
        </button>
      </div>
      {state.error ? (
        <span className="block text-xs text-[var(--fo-danger)]">{state.error}</span>
      ) : null}
      {state.ok ? <span className="block text-xs text-[var(--fo-success)]">{state.ok}</span> : null}
    </form>
  );
}
