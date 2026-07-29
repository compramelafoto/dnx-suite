"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { contestId: string; entryId: string };

const DECISIONS = [
  { value: "APPROVED", label: "Aprobar observación" },
  { value: "CLEARED_WARNING", label: "Limpiar advertencia" },
  { value: "REPLACEMENT_REQUESTED", label: "Solicitar reemplazo" },
  { value: "REJECTED", label: "Rechazar" },
] as const;

export function ManualReviewForm({ contestId, entryId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]["value"]>("CLEARED_WARNING");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await fetch(`/api/fotorank/contests/${contestId}/entries/${entryId}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision, reason }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
          if (!res.ok || !data.ok) {
            setError(data.error?.message ?? "No se pudo guardar la revisión.");
            return;
          }
          router.refresh();
        });
      }}
    >
      <label className="block space-y-3">
        <span className="text-sm font-semibold">Decisión</span>
        <select
          className="fr-filter-select w-full"
          value={decision}
          onChange={(e) => setDecision(e.target.value as typeof decision)}
        >
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-3">
        <span className="text-sm font-semibold">Motivo / notas</span>
        <textarea
          className="fr-filter-input min-h-24 w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo visible en auditoría"
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" className="fr-btn fr-btn-primary px-5 py-3" disabled={pending}>
        Guardar revisión
      </button>
    </form>
  );
}
