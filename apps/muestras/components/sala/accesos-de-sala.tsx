"use client";

import { useState, useTransition } from "react";
import { cambiarCodigosDeSala, cortarAccesosDeSala, type ResultadoSala } from "@/lib/sala/acciones";

const boton = "inline-flex h-11 items-center justify-center rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50";

/**
 * Si una foto del QR circula (spec D34): cortar los pases vigentes (rota la llave) o, si sigue,
 * cambiar los códigos (hay que reimprimir las fichas).
 */
export function AccesosDeSala({ activityId }: { activityId: string }) {
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = (f: () => Promise<ResultadoSala>) =>
    empezar(async () => {
      const r = await f();
      setMensaje(r.ok ? { ok: true, texto: r.aviso } : { ok: false, texto: r.errores.join(" ") });
    });
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap gap-3">
        <button type="button" className={boton} disabled={pendiente} onClick={() => correr(() => cortarAccesosDeSala(activityId))}>
          Cortar los accesos de sala
        </button>
        <button
          type="button" className={boton} disabled={pendiente}
          onClick={() => {
            if (window.confirm("Los QR de las fichas impresas dejan de dar acceso a la sala. Vas a tener que bajar e imprimir las fichas de nuevo. ¿Seguís?")) {
              correr(() => cambiarCodigosDeSala(activityId));
            }
          }}
        >
          Cambiar los códigos de sala
        </button>
      </p>
      {mensaje ? <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? "text-[15px]" : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null}
    </div>
  );
}
