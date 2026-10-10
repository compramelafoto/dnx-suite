"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CONTEST_TIERS, CONTEST_TIER_LABELS, DEFAULT_CONTEST_TIERS, type ContestTier } from "@repo/muestras";
import { armarMuestraDesdeConcurso } from "@/lib/concursos/acciones";
import { alerta, botonLleno, nota } from "./estilos";

type Props = {
  contestId: string;
  counts: Record<ContestTier, number>;
  destinos: { id: string; title: string }[];
};

/** Niveles, destino y "Armar la muestra" (D7, D8). El botón se apaga mientras arma: un doble clic no arma dos. */
export function ArmarMuestra({ contestId, counts, destinos }: Props) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [destino, setDestino] = useState("nueva");

  const enviar = (fd: FormData) =>
    start(async () => {
      setErrores([]);
      const r = await armarMuestraDesdeConcurso(fd);
      if (r.ok) router.push(`/panel/muestras/${r.id}/concurso${r.avisos?.length ? "?nueva=1" : ""}`);
      else setErrores(r.errores);
    });

  return (
    <form action={enviar} className="space-y-8">
      <input type="hidden" name="contestId" value={contestId} />
      <fieldset className="space-y-3">
        <legend className="text-sm text-[var(--mf-muted)]">¿Qué obras traés?</legend>
        {CONTEST_TIERS.map((t) => (
          <label key={t} className="flex items-baseline gap-3 text-[17px]">
            <input type="checkbox" name="tiers" value={t} defaultChecked={DEFAULT_CONTEST_TIERS.includes(t)} disabled={counts[t] === 0} className="size-4" />
            <span>
              {CONTEST_TIER_LABELS[t]} <span className={nota}>({counts[t]} {counts[t] === 1 ? "obra" : "obras"})</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm text-[var(--mf-muted)]">¿Dónde van?</legend>
        <label className="flex items-baseline gap-3 text-[17px]">
          <input type="radio" name="destino" value="nueva" checked={destino === "nueva"} onChange={() => setDestino("nueva")} className="size-4" />
          <span>En una muestra nueva <span className={nota}>(te la armamos en borrador con el nombre del concurso)</span></span>
        </label>
        {destinos.map((d) => (
          <label key={d.id} className="flex items-baseline gap-3 text-[17px]">
            <input type="radio" name="destino" value={d.id} checked={destino === d.id} onChange={() => setDestino(d.id)} className="size-4" />
            <span className="min-w-0 break-words">En “{d.title}”</span>
          </label>
        ))}
      </fieldset>

      <p className={nota}>
        Las imágenes se copian de FotoRank después de armar; los autores van a ver sus obras en “Dónde expongo”.
      </p>
      <div className="space-y-2">
        <button type="submit" disabled={pendiente} className={botonLleno}>{pendiente ? "Armando…" : "Armar la muestra"}</button>
        {errores.length ? <p role="alert" className={alerta}>{errores.join(" ")}</p> : null}
      </div>
    </form>
  );
}
