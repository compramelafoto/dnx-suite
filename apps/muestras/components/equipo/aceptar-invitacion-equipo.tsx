"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceptarInvitacionEquipo } from "@/lib/equipo/acciones";
import { botonLleno } from "./estilos";

export function AceptarInvitacionEquipo({ token }: { token: string }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendiente}
        className={botonLleno}
        onClick={() => start(async () => {
          const r = await aceptarInvitacionEquipo(token);
          if (r.ok) router.push(`/panel/muestras/${r.id}`);
          else setError(r.errores.join(" "));
        })}
      >
        Aceptar
      </button>
      {error ? <p role="alert" className="text-[var(--mf-alerta)]">{error}</p> : null}
    </div>
  );
}
