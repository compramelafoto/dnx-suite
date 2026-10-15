import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import type { EstadoDelPaso, PasoDelLote } from "@/lib/technical-admission/pasos-del-lote";

/**
 * Los cuatro pasos de la admisión, uno debajo del otro.
 *
 * En columna y no en fila: son una secuencia, y una fila de botones iguales
 * no dice que haya un orden. El número, la línea que los une y el estado de
 * cada uno son la explicación; el texto de abajo es el detalle.
 */

const MARCA: Record<EstadoDelPaso, { simbolo: string; etiqueta: string }> = {
  HECHO: { simbolo: "✓", etiqueta: "Hecho" },
  AHORA: { simbolo: "→", etiqueta: "Ahora" },
  ESPERA: { simbolo: "·", etiqueta: "Todavía no" },
};

function estiloDelCirculo(estado: EstadoDelPaso): string {
  if (estado === "HECHO") return "border-ck-yellow bg-ck-yellow text-black";
  if (estado === "AHORA") return "border-ck-yellow text-ck-yellow";
  return "border-ck-border text-ck-text-muted";
}

export function PasosDelLote({
  pasos,
  resumen,
  acciones,
}: {
  pasos: PasoDelLote[];
  resumen: string;
  /** El botón de cada paso, por número. Lo arma la página, que tiene los formularios. */
  acciones: Record<number, ReactNode>;
}) {
  return (
    <Card variant="outlined" className="space-y-5 p-5 sm:p-6">
      <div className="space-y-2">
        <h2 className="font-semibold text-ck-text">Pasos de la admisión</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">{resumen}</p>
        <p className="text-xs leading-relaxed text-ck-text-muted">
          Esto revisa que las fotos cumplan las reglas. Quién gana lo decide el jurado, después.
        </p>
      </div>

      <ol className="space-y-0">
        {pasos.map((paso, i) => {
          const marca = MARCA[paso.estado];
          const esElUltimo = i === pasos.length - 1;
          const apagado = paso.estado === "ESPERA";

          return (
            <li key={paso.numero} className="relative flex gap-4 pb-6 last:pb-0">
              {/* La línea que une los pasos: lo que los vuelve una secuencia. */}
              {!esElUltimo ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-ck-border"
                />
              ) : null}

              <span
                aria-hidden="true"
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${estiloDelCirculo(paso.estado)}`}
              >
                {paso.estado === "ESPERA" ? paso.numero : marca.simbolo}
              </span>

              <div className={`min-w-0 flex-1 space-y-2 ${apagado ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-ck-text">
                    {paso.numero}. {paso.titulo}
                  </h3>
                  <span className="text-xs uppercase tracking-wide text-ck-text-muted">
                    {marca.etiqueta}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-ck-text-secondary">{paso.queHace}</p>

                {paso.aclaracion ? (
                  <p className="border-l-2 border-ck-yellow pl-3 text-sm leading-relaxed text-ck-text">
                    {paso.aclaracion}
                  </p>
                ) : null}

                {acciones[paso.numero] ? (
                  <div className="pt-1">{acciones[paso.numero]}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
