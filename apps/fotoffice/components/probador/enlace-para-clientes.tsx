"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** La dirección pública del probador, lista para copiar y mandarle al cliente. */
export function EnlaceParaClientes({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el enlace igual queda a la vista para copiarlo a mano.
    }
  }

  return (
    <div className="fo-card flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--fo-text)]">Enlace para tus clientes</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-[var(--fo-accent)] underline-offset-2 hover:underline"
        >
          {url}
        </a>
      </div>
      <button type="button" onClick={copiar} className="fo-btn fo-btn-secondary inline-flex items-center gap-2">
        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copiado ? "Copiado" : "Copiar enlace"}
      </button>
    </div>
  );
}
