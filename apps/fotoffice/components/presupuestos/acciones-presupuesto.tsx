"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearNuevaVersionAction, rechazarPresupuestoAction } from "@/app/actions/presupuestos";

/**
 * Acciones de un presupuesto ya enviado (con "Gestionar"): crear la versión siguiente para
 * editarlo y marcarlo como rechazado. Las reglas las vuelve a mirar el servidor.
 */
export function AccionesPresupuesto({
  presupuestoId,
  puedeVersionar,
  puedeRechazar,
  siguienteVersion,
}: {
  presupuestoId: string;
  puedeVersionar: boolean;
  puedeRechazar: boolean;
  siguienteVersion: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: "No se pudo hacer el cambio. Probá de nuevo." }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  if (!puedeVersionar && !puedeRechazar) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {puedeVersionar ? (
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => correr(() => crearNuevaVersionAction(presupuestoId))}>
          Editar (crea la V{siguienteVersion})
        </button>
      ) : null}
      {puedeRechazar ? (
        <button
          type="button"
          className="fo-btn fo-btn-danger-outline text-sm"
          disabled={pendiente}
          onClick={() => {
            if (window.confirm("¿Marcar este presupuesto como rechazado?")) correr(() => rechazarPresupuestoAction(presupuestoId));
          }}
        >
          Marcar rechazado
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
