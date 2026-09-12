"use client";

import { useActionState } from "react";
import { elegirPlantillaAction, type EstadoPlantilla } from "@/app/actions/plantillas";
import { PLANTILLAS } from "@/lib/plantillas";

export function SelectorDePlantilla({
  eventoId,
  claveActual,
}: {
  eventoId: string;
  claveActual: string | null;
}) {
  const [estado, accion, enviando] = useActionState<EstadoPlantilla, FormData>(
    elegirPlantillaAction,
    {},
  );

  const elegida = estado.elegida ?? claveActual;

  return (
    <div className="mt-10 space-y-4">
      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      {PLANTILLAS.map((p) => {
        const esta = elegida === p.clave;
        return (
          <form action={accion} key={p.clave}>
            <input type="hidden" name="eventoId" value={eventoId} />
            <input type="hidden" name="clave" value={p.clave} />
            <button
              type="submit"
              disabled={enviando}
              aria-pressed={esta}
              className="flex w-full items-center gap-5 rounded-2xl border-2 p-4 text-left disabled:opacity-60"
              style={{ borderColor: esta ? "var(--slf-violeta)" : "var(--slf-borde)" }}
            >
              {/* La muestra usa los colores reales de la plantilla: se elige viendo. */}
              <span
                className="flex h-20 w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-xl"
                style={{ background: p.tokens.fondo, fontFamily: p.tokens.tipografia }}
                aria-hidden="true"
              >
                <span className="text-sm font-bold" style={{ color: p.tokens.texto }}>
                  Aa
                </span>
                <span
                  className="rounded-md px-3 py-1 text-[0.65rem] font-bold"
                  style={{ background: p.tokens.acento, color: p.tokens.textoSobreAcento }}
                >
                  Subir
                </span>
              </span>

              <span className="min-w-0">
                <span className="block font-extrabold">
                  {p.nombre}
                  {esta ? (
                    <span
                      className="ml-3 text-xs font-extrabold"
                      style={{ color: "var(--slf-violeta)" }}
                    >
                      elegida
                    </span>
                  ) : null}
                </span>
                <span
                  className="mt-1 block text-sm"
                  style={{ color: "var(--slf-tinta-suave)" }}
                >
                  {p.descripcion}
                </span>
              </span>
            </button>
          </form>
        );
      })}
    </div>
  );
}
