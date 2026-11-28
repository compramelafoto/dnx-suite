"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DecisionForm({ id }: { id: number }) {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState("");
  const [legalName, setLegalName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enviar(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/verificaciones/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "No se pudo guardar la decisión");
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const campo = "w-full rounded border border-gray-300 px-2 py-1 text-sm";
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">Aprobar</p>
        <input
          className={campo}
          placeholder="DNI (sólo números)"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
        />
        <input
          className={campo}
          placeholder="Nombre completo como figura en el DNI"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => enviar({ action: "approve", documentNumber, legalName })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Aprobar
        </button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Rechazar</p>
        <textarea
          className={campo}
          rows={3}
          placeholder="Motivo (se le muestra a la persona)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => enviar({ action: "reject", reason })}
          className="rounded bg-red-700 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2">
          {error}
        </p>
      )}
    </div>
  );
}
