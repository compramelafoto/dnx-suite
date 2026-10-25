"use client";

import { useActionState } from "react";
import { elegirPlantillaAction, type EstadoPlantilla } from "@/app/actions/plantillas";
import { estiloDeTema } from "@/lib/estilo-de-tema";
import { FAMILIAS, plantillasDeFamilia, type Plantilla } from "@/lib/plantillas";

/**
 * El selector de estilo.
 *
 * Agrupado por familia porque el fotógrafo no entra buscando "un violeta": entra
 * buscando "algo para unos quince" o "algo para un congreso". Trece estilos en una lista
 * plana son trece decisiones; en tres grupos son una y después tres o cuatro.
 *
 * Cada muestra se pinta con los colores, la tipografía y la textura de verdad. Un nombre
 * y una descripción no alcanzan para elegir algo que es visual.
 */

function Muestra({ plantilla }: { plantilla: Plantilla }) {
  return (
    <span
      className="flex h-20 w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-xl"
      style={estiloDeTema(plantilla.tokens)}
      aria-hidden="true"
    >
      <span className="text-sm font-bold">Aa</span>
      <span
        className="rounded-md px-3 py-1 text-[0.65rem] font-bold"
        style={{
          background: plantilla.tokens.acento,
          color: plantilla.tokens.textoSobreAcento,
        }}
      >
        Subir
      </span>
    </span>
  );
}

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
    <div className="mt-10 space-y-12">
      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      {FAMILIAS.map((familia) => (
        <section key={familia.clave}>
          <h2 className="text-lg font-extrabold">{familia.nombre}</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            {familia.ayuda}
          </p>

          <div className="mt-5 space-y-4">
            {plantillasDeFamilia(familia.clave).map((p) => {
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
                    <Muestra plantilla={p} />

                    <span className="min-w-0">
                      <span className="block font-extrabold">
                        {p.nombre}
                        {esta ? (
                          <span
                            className="ml-3 text-xs font-extrabold"
                            style={{ color: "var(--slf-violeta-texto)" }}
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
        </section>
      ))}
    </div>
  );
}
