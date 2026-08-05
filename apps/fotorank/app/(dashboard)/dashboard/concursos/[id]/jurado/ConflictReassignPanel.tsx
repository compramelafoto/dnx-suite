"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ConflictRow = {
  id: string;
  entryLabel: string;
  judgeLabel: string;
  reasonCode: string;
};

type JudgeOpt = { id: string; label: string };

type Props = {
  contestId: string;
  conflicts: ConflictRow[];
  backupJudges: JudgeOpt[];
};

export function ConflictReassignPanel({ contestId, conflicts, backupJudges }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [targetByConflict, setTargetByConflict] = useState<Record<string, string>>({});

  if (conflicts.length === 0) {
    return (
      <p className="text-sm text-fr-muted" data-testid="conflicts-empty">
        Sin conflictos activos.
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="conflict-reassign-panel">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
      <ul className="space-y-6">
        {conflicts.map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-fr-border bg-fr-bg/40 p-4 space-y-4"
            data-testid={`conflict-row-${c.id}`}
          >
            <p className="text-sm text-fr-primary">
              Obra {c.entryLabel} · {c.judgeLabel} · {c.reasonCode}
            </p>
            <label className="block space-y-2 text-sm">
              <span className="text-fr-muted">Reasignar a</span>
              <select
                className="fr-filter-select w-full max-w-md"
                value={targetByConflict[c.id] ?? backupJudges[0]?.id ?? ""}
                onChange={(e) =>
                  setTargetByConflict((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
                data-testid={`conflict-reassign-target-${c.id}`}
              >
                {backupJudges.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="fr-btn fr-btn-primary min-h-11 px-5 text-sm"
              disabled={pending || !backupJudges.length}
              data-testid={`conflict-reassign-submit-${c.id}`}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  setOk(null);
                  const toJudgeAccountId =
                    targetByConflict[c.id] ?? backupJudges[0]?.id ?? "";
                  const res = await fetch(
                    `/api/fotorank/contests/${contestId}/jury/conflicts/${c.id}/reassign`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        toJudgeAccountId,
                        reason: "sfef07b-reassign",
                        idempotencyKey: `reassign-${c.id}-${toJudgeAccountId}`,
                      }),
                    },
                  );
                  const json = (await res.json()) as {
                    ok?: boolean;
                    error?: { message?: string };
                  };
                  if (!res.ok || !json.ok) {
                    setError(json.error?.message ?? "Reasignación fallida.");
                    return;
                  }
                  setOk("Conflicto aceptado y obra reasignada.");
                  router.refresh();
                })
              }
            >
              Aceptar conflicto y reasignar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
