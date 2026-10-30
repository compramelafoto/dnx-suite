"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearCasoAction } from "@/app/(shell)/recuperacion/actions";
import { MAX_NOTAS, MAX_TITULO, RECUPERACION_PANEL_ROUTE } from "@/lib/recuperacion/constantes";

export function NuevoCaso() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

  function abrir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      try {
        const r = await crearCasoAction(titulo, notas);
        if (!r.ok) return setError(r.error);
        router.push(`${RECUPERACION_PANEL_ROUTE}/${r.id}`);
      } catch {
        setError("No se pudo abrir el caso. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <form onSubmit={abrir} className="fo-card space-y-3 p-5" aria-label="Abrir un caso de recuperación">
      <h2 className="text-base font-semibold">Abrir un caso</h2>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="rec-titulo">Nombre del caso</label>
        <input id="rec-titulo" className="fo-input" maxLength={MAX_TITULO} placeholder="Por ejemplo, Casamiento Juli y Fede · tarjeta 2" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="rec-notas">Notas (opcional)</label>
        <textarea id="rec-notas" className="fo-input" rows={2} maxLength={MAX_NOTAS} placeholder="Qué pasó con la tarjeta, qué fotos se buscan…" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || titulo.trim().length === 0}>
        {pendiente ? "Abriendo…" : "Abrir caso"}
      </button>
      {error ? <p role="alert" className="text-sm text-[var(--fo-danger,#b00020)]">{error}</p> : null}
    </form>
  );
}
