"use client";

import { useState } from "react";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import { displayVideoTitle } from "./public-video-ui";

type Props = {
  video: PublicVideoDto | null;
  albumId: number;
  onClose: () => void;
};

/**
 * Pedido de baja de un video, por derecho de imagen.
 *
 * La diferencia con las fotos está dicha de frente: acá se baja el video
 * **entero**, porque no se puede recortar a una persona de una escena en
 * movimiento. Quien lo pide tiene que saber que puede estar sacando de
 * circulación material donde aparece más gente.
 */
export default function VideoRemovalModal({ video, albumId, onClose }: Props) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [motivo, setMotivo] = useState("");
  const [declaro, setDeclaro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  if (!video) return null;

  const puedeEnviar =
    nombre.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    telefono.trim().length >= 6 &&
    motivo.trim().length >= 10 &&
    declaro &&
    !enviando;

  async function enviar() {
    if (!puedeEnviar || !video) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/video-removal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId,
          videoId: video.id,
          requesterName: nombre.trim(),
          requesterEmail: email.trim(),
          requesterPhone: telefono.trim(),
          reason: motivo.trim(),
          declarationOk: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos enviar el pedido");
      setListo(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No pudimos enviar el pedido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="ds-card flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {listo ? (
          <>
            <h2 className="text-lg font-semibold text-[#111827]">Pedido enviado</h2>
            <p className="mt-2 text-sm text-[#374151]">
              Le avisamos al fotógrafo. Te va a contactar por el mail o el teléfono
              que dejaste.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white"
            >
              Cerrar
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#111827]">
              Pedir que den de baja este video
            </h2>
            <p className="mt-1 truncate text-sm text-[#6b7280]">
              {displayVideoTitle(video)}
            </p>

            <div className="mt-3 rounded-lg bg-[#fef3c7] px-3 py-2.5 text-sm text-[#92400e]">
              Tené en cuenta que el video se da de baja <strong>entero</strong>. A
              diferencia de una foto, no se puede recortar a una persona de una
              escena en movimiento, así que puede dejar de estar disponible
              material donde aparece más gente.
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                placeholder="Tu nombre y apellido"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-lg border border-[#d1d5db] px-3 py-2.5 text-sm"
              />
              <input
                type="email"
                placeholder="Tu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-[#d1d5db] px-3 py-2.5 text-sm"
              />
              <input
                type="tel"
                placeholder="Tu teléfono o WhatsApp"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-lg border border-[#d1d5db] px-3 py-2.5 text-sm"
              />
              <textarea
                placeholder="Contanos por qué pedís la baja (mínimo 10 caracteres)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="rounded-lg border border-[#d1d5db] px-3 py-2.5 text-sm"
              />
              <label className="flex items-start gap-2 text-sm text-[#374151]">
                <input
                  type="checkbox"
                  checked={declaro}
                  onChange={(e) => setDeclaro(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Declaro que aparezco en este video o que soy responsable legal de
                  quien aparece.
                </span>
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-[#b91c1c]">{error}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#d1d5db] px-4 py-2.5 text-sm font-medium text-[#374151]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={!puedeEnviar}
                className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:bg-[#d1d5db]"
              >
                {enviando ? "Enviando..." : "Pedir la baja"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
