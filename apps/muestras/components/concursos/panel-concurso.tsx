"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CONTEST_TIERS, CONTEST_TIER_LABELS, type ContestTier } from "@repo/muestras";
import { actualizarDesdeConcurso } from "@/lib/concursos/acciones";
import { alerta, boton, nota } from "./estilos";

/**
 * "Actualizar desde FotoRank" (D11), con los niveles: suma lo nuevo, actualiza premios y orden, y
 * marca lo que ya no figura. Nunca saca obras ni pisa títulos.
 */
export function ActualizarDesdeConcurso({ activityId, tiers, destacado }: { activityId: string; tiers: readonly ContestTier[]; destacado: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [elegidos, setElegidos] = useState<ContestTier[]>([...tiers]);
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string } | null>(null);
  const alternar = (t: ContestTier) => setElegidos((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  return (
    <div className="space-y-3">
      <fieldset disabled={pendiente} className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className={`${nota} mb-2`}>Niveles que se traen</legend>
        {CONTEST_TIERS.map((t) => (
          <label key={t} className="flex items-center gap-2 text-[15px]">
            <input type="checkbox" checked={elegidos.includes(t)} onChange={() => alternar(t)} className="size-4" />
            {CONTEST_TIER_LABELS[t]}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={pendiente || elegidos.length === 0}
        className={destacado ? `${boton} bg-[var(--mf-ink)] text-[var(--mf-bg)]` : boton}
        onClick={() => start(async () => {
          setMensaje(null);
          const r = await actualizarDesdeConcurso(activityId, elegidos);
          setMensaje(r.ok ? { error: false, texto: r.avisos?.join(" ") || "Listo: la muestra está al día con FotoRank." } : { error: true, texto: r.errores.join(" ") });
          router.refresh();
        })}
      >
        {pendiente ? "Actualizando…" : "Actualizar desde FotoRank"}
      </button>
      {mensaje ? <p role={mensaje.error ? "alert" : "status"} className={mensaje.error ? alerta : nota}>{mensaje.texto}</p> : null}
    </div>
  );
}
