"use client";

import { useActionState } from "react";
import { cambiarQueVenAction, type EstadoQueVen } from "@/app/actions/que-ven-los-invitados";

type Interruptor = {
  campo: "guestsCanSeeAlbum" | "guestsCanSeeLive";
  titulo: string;
  ayuda: string;
  encendido: boolean;
};

/**
 * Qué ven los invitados.
 *
 * Los dos campos existían en la base desde el principio y no había pantalla para
 * cambiarlos: el álbum se apagó a mano con SQL. Un interruptor que sólo se toca con una
 * consulta no es un interruptor.
 */
export function QueVen({ eventoId, interruptores }: { eventoId: string; interruptores: Interruptor[] }) {
  const [estado, cambiar, enviando] = useActionState<EstadoQueVen, FormData>(
    cambiarQueVenAction,
    {},
  );

  return (
    <ul className="mt-6 space-y-4">
      {interruptores.map((i) => (
        <li
          key={i.campo}
          className="flex flex-wrap items-start justify-between gap-4 rounded-2xl p-4"
          style={{ border: "1px solid var(--slf-borde)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{i.titulo}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
              {i.ayuda}
            </p>
          </div>

          <form action={cambiar}>
            <input type="hidden" name="eventoId" value={eventoId} />
            <input type="hidden" name="campo" value={i.campo} />
            <input type="hidden" name="encender" value={i.encendido ? "0" : "1"} />
            <button
              type="submit"
              disabled={enviando}
              aria-pressed={i.encendido}
              className="min-h-[44px] rounded-xl px-4 text-sm font-extrabold disabled:opacity-60"
              style={
                i.encendido
                  ? { background: "var(--slf-violeta-texto)", color: "white" }
                  : { border: "1px solid var(--slf-borde)", color: "var(--slf-tinta-suave)" }
              }
            >
              {i.encendido ? "Encendido" : "Apagado"}
            </button>
          </form>
        </li>
      ))}

      {estado.error ? (
        <li className="text-sm" style={{ color: "#B3261E" }} aria-live="polite">
          {estado.error}
        </li>
      ) : null}
    </ul>
  );
}
