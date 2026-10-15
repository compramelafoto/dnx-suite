"use client";

import { useState } from "react";

/** Botón del modo prueba: deja el pack listo otra vez para repetir el canje. */
export default function ReiniciarPruebaButton({ token }: { token: string }) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "error">("listo");
  const [error, setError] = useState<string | null>(null);

  async function reiniciar() {
    setEstado("enviando");
    setError(null);
    try {
      const res = await fetch(`/api/public/pack/${encodeURIComponent(token)}/reiniciar-prueba`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo reiniciar la prueba.");
      window.location.reload();
    } catch (e) {
      setEstado("error");
      setError(e instanceof Error ? e.message : "No se pudo reiniciar la prueba.");
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => void reiniciar()}
        disabled={estado === "enviando"}
        className="rounded-xl bg-[#a8652e] px-5 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {estado === "enviando" ? "Reiniciando…" : "Reiniciar prueba"}
      </button>
      {error ? <p className="m-0 mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
