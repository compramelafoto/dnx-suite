"use client";

import { useState } from "react";
import { LARGO_MAXIMO_MENSAJE } from "@/lib/mensajes";

/**
 * Dejar un mensaje para la pantalla del salón.
 *
 * A diferencia de las reacciones, acá **no se promete inmediatez**: el mensaje lo tiene
 * que aprobar el fotógrafo antes de proyectarse, y el invitado tiene que saberlo en el
 * momento de mandarlo. Si creyera que sale solo y no lo ve en la pantalla, va a mandarlo
 * cinco veces más.
 */
export function DejarMensaje({ codigo, acento }: { codigo: string; acento: string }) {
  const [texto, setTexto] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mandados, setMandados] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const quedan = LARGO_MAXIMO_MENSAJE - texto.length;

  async function mandar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || texto.trim().length === 0) return;

    setEnviando(true);
    setError(null);

    try {
      const res = await fetch(`/api/e/${codigo}/mensaje`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto, nombre }),
      });
      const datos = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(datos?.error ?? "No se pudo mandar. Probá de nuevo.");
        return;
      }

      setTexto("");
      setMandados((n) => n + 1);
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(e) => void mandar(e)} className="mt-10 w-full max-w-sm text-left">
      <label htmlFor="mensaje" className="block text-[0.95rem] font-semibold opacity-80">
        Dejá tu mensaje
      </label>

      <textarea
        id="mensaje"
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, LARGO_MAXIMO_MENSAJE))}
        rows={3}
        placeholder="Feliz cumple! Te queremos mucho"
        className="mt-3 w-full rounded-2xl px-4 py-3"
        style={{
          background: "rgba(255,255,255,0.12)",
          border: `1px solid ${acento}44`,
          color: "inherit",
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value.slice(0, 40))}
          placeholder="Tu nombre (opcional)"
          aria-label="Tu nombre, opcional"
          className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: `1px solid ${acento}33`,
            color: "inherit",
          }}
        />
        <span className="shrink-0 text-xs tabular-nums opacity-60">{quedan}</span>
      </div>

      <button
        type="submit"
        disabled={enviando || texto.trim().length === 0}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl font-extrabold disabled:opacity-50"
        style={{ background: acento, color: "var(--slf-purpura, #200638)" }}
      >
        {enviando ? "Mandando…" : "Mandar mensaje"}
      </button>

      <p className="mt-3 text-sm opacity-75" aria-live="polite">
        {error ??
          (mandados > 0
            ? `Listo. ${mandados === 1 ? "Tu mensaje va" : "Tus mensajes van"} a aparecer en la pantalla cuando lo apruebe el fotógrafo.`
            : "Lo revisa el fotógrafo antes de que salga en la pantalla.")}
      </p>
    </form>
  );
}
