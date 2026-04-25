"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFotorankActiveWorkspace } from "../../actions/workspace";

type Ws = { id: string; name: string };

/**
 * Workspace activo de la suite (DNX). Oculto si hay 0 o 1 workspace.
 */
export function FotorankWorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Ws[];
  activeWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (workspaces.length <= 1) return null;

  return (
    <div className="mt-3 w-full space-y-2 border-t border-fr-border pt-3">
      <p className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-fr-muted-soft">
        Workspace suite
      </p>
      <select
        className="w-full rounded-lg border border-fr-border bg-fr-bg px-2 py-2 text-sm text-fr-primary"
        value={activeWorkspaceId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          startTransition(async () => {
            const r = await setFotorankActiveWorkspace(v);
            if (r.ok) router.refresh();
          });
        }}
        aria-label="Elegir workspace activo de la suite"
      >
        {!activeWorkspaceId ? (
          <option value="" disabled>
            Elegí un workspace…
          </option>
        ) : null}
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
