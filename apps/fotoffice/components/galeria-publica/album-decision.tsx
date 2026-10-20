"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_NOTA_RONDA, type DecisionAlbum } from "@/lib/galerias/constantes";

/**
 * Pantalla de confirmación de la decisión: resume lo que dejó el cliente y pide (opcional, u obligatorio si pide cambios
 * sin haber comentado) un mensaje para el estudio. `onConfirmar` devuelve el error o null si salió bien.
 */
export function ConfirmarDecision({
  decision,
  comentarios,
  laminasConComentarios,
  onConfirmar,
  onVolver,
}: {
  decision: DecisionAlbum;
  comentarios: number;
  laminasConComentarios: number;
  onConfirmar: (mensaje: string) => Promise<string | null>;
  onVolver: () => void;
}) {
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const aprueba = decision === "APROBADO";
  const obligatorio = !aprueba && comentarios === 0;

  useEffect(() => {
    campo.current?.focus();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape" && !enviando) onVolver();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onVolver, enviando]);

  async function confirmar() {
    if (enviando) return;
    if (obligatorio && !mensaje.trim()) return setError("Contale al estudio qué querés cambiar, o dejá un comentario en alguna lámina.");
    setEnviando(true);
    setError(null);
    const e = await onConfirmar(mensaje);
    setEnviando(false);
    if (e) setError(e);
  }

  const resumen =
    comentarios === 0
      ? "No dejaste comentarios en las láminas."
      : `Dejaste ${comentarios === 1 ? "1 comentario" : `${comentarios.toLocaleString("es-AR")} comentarios`} en ${laminasConComentarios === 1 ? "1 lámina" : `${laminasConComentarios.toLocaleString("es-AR")} láminas`}.`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="album-decision-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 text-neutral-900 shadow-2xl sm:rounded-2xl">
        <h2 id="album-decision-titulo" className="text-xl font-semibold">
          {aprueba ? "¿Aprobás el álbum?" : "¿Pedís cambios?"}
        </h2>
        <p className="text-sm text-neutral-700">{resumen}</p>
        <p className="text-sm text-neutral-700">
          {aprueba
            ? "Al aprobar, el estudio sabe que está todo bien y avanza con la producción. Después no vas a poder cambiar tu decisión desde acá."
            : "El estudio recibe tus comentarios, hace las correcciones y te manda una ronda nueva para revisar. Después no vas a poder cambiar tu decisión desde acá."}
        </p>
        <div>
          <label htmlFor="album-decision-mensaje" className="mb-1 block text-sm font-medium">
            {obligatorio ? "Mensaje para el estudio" : "Mensaje para el estudio (opcional)"}
          </label>
          <textarea
            id="album-decision-mensaje"
            ref={campo}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            maxLength={MAX_NOTA_RONDA}
            rows={4}
            placeholder={aprueba ? "Si querés, dejale unas palabras." : "Contale qué querés cambiar."}
            className="w-full resize-y rounded-md border border-neutral-300 p-2 text-base text-neutral-900"
          />
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onVolver} disabled={enviando} className="fo-btn fo-btn-secondary">
            Volver a revisar
          </button>
          <button type="button" onClick={confirmar} disabled={enviando} className="fo-btn fo-btn-primary">
            {enviando ? "Enviando…" : aprueba ? "Sí, aprobar el álbum" : "Sí, pedir cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
