"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CallPhase } from "@repo/muestras";
import { abrirConvocatoria, cerrarConvocatoria, cerrarCuraduria, empezarCuraduria, volverABorrador } from "@/lib/convocatorias/acciones";
import { botonFino, botonLleno } from "./estilos";

type Accion = { texto: string; correr: () => Promise<{ ok: boolean; errores?: string[] }>; confirmar?: string; principal?: boolean };

/** Los botones que corresponden a la fase. El servidor vuelve a verificar cada uno. */
export function AccionesConvocatoria({ id, fase }: { id: string; fase: CallPhase }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const acciones: Accion[] = [];
  if (fase === "DRAFT") acciones.push({ texto: "Abrir la convocatoria", correr: () => abrirConvocatoria(id), principal: true, confirmar: "Se publica en la página de convocatorias. Después, el tope de obras, la apertura y el texto de derechos ya no se pueden cambiar." });
  if (fase === "UPCOMING" || fase === "RECEIVING") acciones.push({ texto: "Volver a borrador", correr: () => volverABorrador(id), confirmar: "La convocatoria deja de verse en la página pública." });
  if (fase === "ENDED") acciones.push({ texto: "Cerrar la convocatoria", correr: () => cerrarConvocatoria(id), principal: true, confirmar: "Se asigna un código anónimo a cada obra y se avisa por mail a quienes enviaron." });
  if (fase === "CLOSED") acciones.push({ texto: "Empezar la curaduría", correr: () => empezarCuraduria(id), principal: true, confirmar: "El equipo curatorial empieza a ver y puntuar las obras." });
  if (fase === "CURATING") acciones.push({ texto: "Cerrar la curaduría", correr: () => cerrarCuraduria(id), principal: true, confirmar: "Las decisiones quedan firmes, vas a ver los nombres de los autores y cada participante recibe un mail con el resultado. No se puede deshacer." });

  if (acciones.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {acciones.map((a) => (
          <button
            key={a.texto}
            type="button"
            disabled={pendiente}
            className={a.principal ? botonLleno : botonFino}
            onClick={() => {
              if (a.confirmar && !window.confirm(a.confirmar)) return;
              start(async () => {
                const r = await a.correr();
                setError(r.ok ? null : (r.errores ?? []).join(" "));
                if (r.ok) router.refresh();
              });
            }}
          >
            {a.texto}
          </button>
        ))}
      </div>
      {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}
    </div>
  );
}
