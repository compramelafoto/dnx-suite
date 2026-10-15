"use client";

import { useState } from "react";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { ETIQUETA_CANAL } from "@/lib/plantillas/constantes";
import { recortar, type MensajeVista } from "@/lib/plantillas/vista-mensaje";

/**
 * Un mensaje registrado (correo o WhatsApp): estado, "Automático", asunto, destino, plantilla
 * y el cuerpo recortado con "Ver completo". Lo usan la línea de tiempo y el historial de la
 * consulta. Con `conEncabezado`, también quién y cuándo (en hora de Buenos Aires).
 */
export function MensajeRegistrado({ mensaje, conEncabezado = false }: { mensaje: MensajeVista; conEncabezado?: boolean }) {
  const [completo, setCompleto] = useState(false);
  const corto = recortar(mensaje.cuerpo);
  return (
    <div className="space-y-1">
      {conEncabezado ? (
        <p className="text-xs text-[var(--fo-muted)]">
          <time dateTime={mensaje.fecha}>{fechaHoraBA(mensaje.fecha)}</time> · {mensaje.quien} · {ETIQUETA_CANAL[mensaje.canal]}
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={
            mensaje.fallo
              ? "rounded-full bg-[var(--fo-danger-soft)] px-2 py-0.5 text-[var(--fo-danger)]"
              : "rounded-full bg-[var(--fo-success-soft)] px-2 py-0.5 text-[var(--fo-success)]"
          }
        >
          {mensaje.estado}
        </span>
        {mensaje.automatico ? (
          <span className="rounded-full bg-[var(--fo-surface-muted)] px-2 py-0.5 text-[var(--fo-text-secondary)]">Automático</span>
        ) : null}
        <span className="break-all text-[var(--fo-muted)]">a {mensaje.destino}</span>
        {mensaje.plantilla ? <span className="text-[var(--fo-muted)]">· Plantilla «{mensaje.plantilla}»</span> : null}
      </p>
      {mensaje.asunto ? <p className="break-words font-medium text-[var(--fo-text)]">{mensaje.asunto}</p> : null}
      <p className="whitespace-pre-wrap break-words text-[var(--fo-text-secondary)]">{completo || !corto ? mensaje.cuerpo : corto}</p>
      {corto ? (
        <button
          type="button"
          className="text-xs font-medium text-[var(--fo-accent)] hover:underline"
          aria-expanded={completo}
          onClick={() => setCompleto((v) => !v)}
        >
          {completo ? "Ver menos" : "Ver completo"}
        </button>
      ) : null}
    </div>
  );
}
