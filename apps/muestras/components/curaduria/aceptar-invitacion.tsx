"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { botonLleno } from "@/components/convocatorias/estilos";
import { aceptarInvitacion } from "@/lib/curaduria/acciones";

export function AceptarInvitacion({ token }: { token: string }) {
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
          const r = await aceptarInvitacion(token);
          if (r.ok) router.push("/panel/curaduria");
          else setError(r.errores.join(" "));
        })}
      >
        Aceptar y sumarme al equipo
      </button>
      {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}
    </div>
  );
}
