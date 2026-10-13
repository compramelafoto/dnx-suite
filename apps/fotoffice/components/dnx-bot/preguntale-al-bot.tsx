"use client";

import { abrirDnxBot } from "@repo/dnx-bot/ui";

/**
 * Botón «Preguntale al bot»: abre la burbuja con un primer mensaje y el contexto de la pantalla
 * (spec §4.1). Quien lo monta decide si se muestra (sólo si `botEnPanel()` no es null): si la
 * burbuja no está, el evento no lo escucha nadie.
 */
export function PreguntaleAlBot({
  etiqueta,
  mensaje,
  contexto,
  className = "fo-btn fo-btn-secondary text-sm",
}: {
  etiqueta: string;
  mensaje: string;
  contexto?: Record<string, string>;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => abrirDnxBot({ texto: mensaje, ...(contexto ? { contexto } : {}) })}>
      {etiqueta}
    </button>
  );
}
