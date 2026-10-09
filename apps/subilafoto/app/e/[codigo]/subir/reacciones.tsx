"use client";

import { useState } from "react";
import { EMOJIS } from "@/lib/reacciones";

/**
 * La barra de emojis del invitado.
 *
 * Lo que manda aparece volando en la pantalla del salón en menos de dos segundos. Esa
 * inmediatez es todo el valor: si tocás y no pasa nada visible, nadie lo vuelve a tocar.
 *
 * Por eso el botón **no espera la respuesta del servidor** para festejar: crece, vibra y
 * sigue. Si el envío falla —tocaste muy rápido, se cortó el wifi— se avisa en chico, sin
 * alertas ni carteles que tapen la fiesta.
 */

/** Cuánto dura el salto del botón al tocarlo. */
const SALTO_MS = 400;

export function BarraDeReacciones({
  codigo,
  acento,
}: {
  codigo: string;
  acento: string;
}) {
  const [saltando, setSaltando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mandadas, setMandadas] = useState(0);

  async function mandar(emoji: string) {
    setSaltando(emoji);
    setTimeout(() => setSaltando((actual) => (actual === emoji ? null : actual)), SALTO_MS);

    // Se cuenta antes de que conteste el servidor: la respuesta tiene que ser inmediata.
    setMandadas((n) => n + 1);
    setAviso(null);

    try {
      const res = await fetch(`/api/e/${codigo}/reaccion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (!res.ok) {
        const datos = (await res.json().catch(() => null)) as { error?: string } | null;
        // Se descuenta lo que se había contado de más.
        setMandadas((n) => Math.max(0, n - 1));
        setAviso(datos?.error ?? "No se pudo mandar. Probá de nuevo.");
      }
    } catch {
      setMandadas((n) => Math.max(0, n - 1));
      setAviso("Sin conexión. Probá de nuevo.");
    }
  }

  return (
    <section className="mt-12 w-full max-w-sm">
      <p className="mb-4 text-[0.95rem] font-semibold opacity-80">
        Mandá tu reacción a la pantalla
      </p>

      <div className="grid grid-cols-6 gap-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => void mandar(emoji)}
            aria-label={`Mandar ${emoji} a la pantalla`}
            className="flex aspect-square items-center justify-center rounded-2xl text-[clamp(1.5rem,7vw,2rem)] transition-transform active:scale-95"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: `1px solid ${acento}44`,
              transform: saltando === emoji ? "scale(1.25)" : undefined,
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {mandadas > 0 ? (
        <p className="mt-3 text-sm opacity-70">
          Mandaste {mandadas} {mandadas === 1 ? "reacción" : "reacciones"}
        </p>
      ) : null}

      {aviso ? <p className="mt-2 text-sm opacity-90">{aviso}</p> : null}

      <style>{`
        /* Si alguien configuró su teléfono para no ver animaciones, se respeta. */
        @media (prefers-reduced-motion: reduce) {
          button { transition: none !important; }
        }
      `}</style>
    </section>
  );
}
