"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { contestId: string; entryId: string };

const REASONS = [
  { value: "KNOW_AUTHOR", label: "Conozco al autor" },
  { value: "PROFESSIONAL_RELATION", label: "Relación profesional" },
  { value: "FAMILY_RELATION", label: "Relación familiar" },
  { value: "PARTICIPATED_IN_PRODUCTION", label: "Participé en la producción" },
  { value: "OTHER", label: "Otro conflicto" },
] as const;

export function JuryConflictForm({ contestId, entryId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasonCode, setReasonCode] = useState<(typeof REASONS)[number]["value"]>("KNOW_AUTHOR");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await fetch(
            `/api/fotorank/jury/contests/${contestId}/entries/${entryId}/conflict`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reasonCode, notes }),
            },
          );
          const data = (await res.json()) as { ok?: boolean; error?: { message?: string }; message?: string };
          if (!res.ok || !data.ok) {
            setError(data.error?.message ?? "No se pudo declarar el conflicto.");
            return;
          }
          router.push(`/jurado/concursos/${contestId}`);
          router.refresh();
        });
      }}
    >
      <label className="block space-y-3">
        <span className="text-sm font-semibold">Motivo</span>
        <select
          className="fr-filter-select w-full"
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as typeof reasonCode)}
          data-testid="jury-conflict-reason"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-3">
        <span className="text-sm font-semibold">Notas (opcional)</span>
        <textarea
          className="fr-filter-input min-h-24 w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
        disabled={pending}
        data-testid="jury-conflict-submit"
      >
        Declaro que no puedo evaluar esta obra
      </button>
    </form>
  );
}
