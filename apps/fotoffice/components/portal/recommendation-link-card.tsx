"use client";

import { useState } from "react";

/**
 * El enlace del socio, listo para repartir.
 *
 * Es un componente cliente por una sola razón: copiar al portapapeles y abrir WhatsApp
 * necesitan el navegador. Todo lo demás de la pantalla se resuelve en el servidor.
 */
export function RecommendationLinkCard({
  url,
  institution,
}: {
  url: string;
  institution: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const mensaje = `Te invito a asociarte a ${institution}. Entrá por acá: ${url}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles el enlace igual está a la vista para copiarlo a mano:
      // no se muestra un error por algo que la persona puede resolver seleccionando el texto.
      setCopiado(false);
    }
  }

  return (
    <section className="fo-card space-y-3 p-5">
      <h2 className="text-sm font-semibold">Tu enlace para recomendar</h2>
      <p className="break-all rounded-lg border border-[var(--fo-border)] px-3 py-2 font-mono text-xs">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className="fo-btn fo-btn-primary text-sm">
          {copiado ? "¡Copiado!" : "Copiar enlace"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fo-btn fo-btn-secondary text-sm"
        >
          Compartir por WhatsApp
        </a>
      </div>
      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        Quien se asocie entrando por este enlace queda registrado como recomendado tuyo.
      </p>
    </section>
  );
}
