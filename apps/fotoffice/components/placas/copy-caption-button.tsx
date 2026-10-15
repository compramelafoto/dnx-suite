"use client";

import { useState } from "react";

/**
 * Copia el texto sugerido de una placa.
 *
 * Componente cliente por una sola razón: el portapapeles necesita el navegador. El texto viene
 * armado del servidor y también queda a la vista, para copiarlo a mano si el navegador no deja.
 */
export function CopyCaptionButton({ text }: { text: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(text);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button type="button" onClick={copiar} className="fo-btn fo-btn-secondary text-xs">
      {copiado ? "¡Copiado!" : "Copiar texto sugerido"}
    </button>
  );
}
