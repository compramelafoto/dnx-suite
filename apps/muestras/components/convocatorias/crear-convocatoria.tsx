"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearConvocatoria } from "@/lib/convocatorias/acciones";
import { botonFino } from "./estilos";

export function CrearConvocatoria({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="space-y-1">
      <button
        type="button"
        disabled={pendiente}
        className={botonFino}
        onClick={() => start(async () => {
          const r = await crearConvocatoria(activityId);
          if (r.ok) router.push(`/panel/convocatorias/${r.id}`);
          else setError(r.errores.join(" "));
        })}
      >
        {pendiente ? "Creando…" : "Armar su convocatoria"}
      </button>
      {error ? <span className="block text-sm text-[var(--mf-alerta)]">{error}</span> : null}
    </span>
  );
}
