"use client";

import { useState } from "react";
import { MAX_COMENTARIO } from "@/lib/galerias/constantes";
import type { ComentarioPublico } from "@/lib/galerias/publico-tipos";

/**
 * La conversación de una foto: los comentarios del cliente y las respuestas del estudio, y (si todavía
 * puede) un cuadro para escribir. El servidor vuelve a validar todo: acá sólo se guía.
 */
export function PanelComentarios({
  comentarios,
  nombreEstudio,
  puedeComentar,
  onEnviar,
}: {
  comentarios: ComentarioPublico[];
  nombreEstudio: string;
  puedeComentar: boolean;
  onEnviar: (texto: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (enviando || texto.trim() === "") return;
    setEnviando(true);
    setError(null);
    const r = await onEnviar(texto);
    setEnviando(false);
    if (r.ok) setTexto("");
    else setError(r.error);
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {comentarios.length === 0 ? (
        <p className="text-sm opacity-70">{puedeComentar ? "Todavía no dejaste comentarios en esta foto." : "Esta foto no tiene comentarios."}</p>
      ) : (
        <ul className="min-h-0 space-y-2 overflow-y-auto" aria-label="Comentarios de esta foto">
          {comentarios.map((c) => (
            <li key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.autor === "CLIENTE" ? "bg-white/10" : "bg-sky-500/20"}`}>
              <p className="text-xs opacity-70">
                {c.autor === "CLIENTE" ? "Vos" : nombreEstudio || "El estudio"} · {c.fecha}
              </p>
              <p className="whitespace-pre-line break-words">{c.texto}</p>
            </li>
          ))}
        </ul>
      )}
      {puedeComentar ? (
        <form onSubmit={enviar} className="space-y-2">
          <label className="sr-only" htmlFor="galeria-comentario">Tu comentario sobre esta foto</label>
          <textarea
            id="galeria-comentario"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void enviar();
            }}
            maxLength={MAX_COMENTARIO}
            rows={3}
            placeholder="Escribí lo que quieras contarnos de esta foto"
            className="w-full rounded-lg border border-white/30 bg-black/40 p-2 text-base text-white placeholder:text-white/50"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-60">{texto.length}/{MAX_COMENTARIO}</span>
            <button type="submit" disabled={enviando || texto.trim() === ""} className="fo-btn fo-btn-primary">
              {enviando ? "Enviando…" : "Dejar comentario"}
            </button>
          </div>
          {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
