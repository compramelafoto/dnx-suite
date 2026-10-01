"use client";

import { useState } from "react";

/**
 * El identificador técnico no se muestra: se copia.
 *
 * Un cuid a la vista no le dice nada a nadie y ensucia la pantalla, pero a
 * veces hace falta para soporte.
 */
export function CopiarIdentificador({ id, etiqueta = "Copiar identificador" }: { id: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sin permiso de portapapeles no hay nada que hacer, y romper la
          // pantalla por esto sería peor.
        }
      }}
      className="text-xs text-fr-muted underline underline-offset-2 hover:text-fr-primary"
    >
      {copiado ? "Copiado" : "Copiar id"}
    </button>
  );
}
