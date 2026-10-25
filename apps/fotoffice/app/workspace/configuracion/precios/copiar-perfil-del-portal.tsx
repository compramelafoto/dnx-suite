"use client";

import { useState, useTransition } from "react";
import { copiarPerfilDelPortalAction } from "./actions";

/**
 * Para quien creó su negocio después de armar su ¿Cuánto Cobro? en el portal de socio: traerlo
 * acá con un clic en vez de volver a cargar gastos y horas. Sólo aparece si el negocio todavía no
 * tiene perfil de precios.
 */
export function CopiarPerfilDelPortal() {
  const [copiando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fo-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p>
          <strong>Ya armaste tu ¿Cuánto Cobro? en el portal de socio.</strong> Podés usarlo como punto de partida de los precios de tu negocio. En el
          portal queda como está.
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="fo-btn fo-btn-primary shrink-0"
        disabled={copiando}
        onClick={() =>
          empezar(async () => {
            setError(null);
            const r = await copiarPerfilDelPortalAction();
            if (!r.ok) setError(r.error);
          })
        }
      >
        {copiando ? "Copiando…" : "Copiar mi perfil"}
      </button>
    </div>
  );
}
