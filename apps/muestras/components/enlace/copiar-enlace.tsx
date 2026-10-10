"use client";

import { useState } from "react";
import { botonFino, campo } from "@/components/convocatorias/estilos";

/**
 * Un enlace para copiar a mano (invitación al equipo, enlace personal de la asistencia). Es lo que
 * hace andar todo con el correo apagado: la persona lo copia y lo manda por WhatsApp o por mail.
 */
export function CopiarEnlace({ url, etiqueta }: { url: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-3">
      <label className="min-w-0 flex-1 basis-64">
        <span className="sr-only">{etiqueta}</span>
        <input type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={campo} />
      </label>
      <button type="button" className={botonFino} onClick={copiar}>{copiado ? "Copiado" : "Copiar enlace"}</button>
    </div>
  );
}
