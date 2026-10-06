"use client";

import { useState } from "react";
import { Link2, MessageCircle } from "lucide-react";

/**
 * "Copiar enlace" y "Compartir por WhatsApp" de un proyecto o una reunión.
 *
 * Cliente sólo por el portapapeles. El mensaje llega armado desde el servidor
 * (`lib/governance/share.ts`) y se puede editar en WhatsApp antes de mandarlo.
 */
export function ShareButtons({ url, message, label }: { url: string; message: string; label: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles, el enlace queda a la vista en el título del botón.
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copiar} className="fo-btn fo-btn-secondary text-sm" title={url}>
        <Link2 className="size-4" aria-hidden />
        {copiado ? "¡Enlace copiado!" : "Copiar enlace"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fo-btn fo-btn-secondary text-sm"
      >
        <MessageCircle className="size-4" aria-hidden />
        Compartir por WhatsApp
      </a>
      <span className="text-xs text-[var(--fo-muted)]">{label}</span>
    </div>
  );
}
