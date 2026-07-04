"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setComprameLaFotoActiveWorkspace } from "@/app/actions/workspace";

type MePayload = {
  user?: unknown;
  workspaces?: { id: string; name: string }[];
  activeWorkspaceId?: string | null;
  forbiddenApp?: string;
};

/**
 * Selector de workspace activo (suite DNX). Oculto si hay 0 o 1 workspace.
 */
export function SuiteWorkspaceSwitcher() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{
    workspaces: { id: string; name: string }[];
    activeId: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as MePayload;
      if (!data.user || data.forbiddenApp) {
        setState(null);
        return;
      }
      const ws = Array.isArray(data.workspaces) ? data.workspaces : [];
      setState({
        workspaces: ws,
        activeId: data.activeWorkspaceId ?? null,
      });
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = (nextId: string) => {
    startTransition(async () => {
      const r = await setComprameLaFotoActiveWorkspace(nextId);
      if (r.ok) {
        router.refresh();
        await load();
      }
    });
  };

  if (!state || state.workspaces.length <= 1) return null;

  return (
    <div className="px-3 pb-3 border-b border-gray-100">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        Workspace activo
      </label>
      <select
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900"
        value={state.activeId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          onChange(v);
        }}
        aria-label="Elegir workspace activo"
      >
        {!state.activeId ? (
          <option value="" disabled>
            Elegí un workspace…
          </option>
        ) : null}
        {state.workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
