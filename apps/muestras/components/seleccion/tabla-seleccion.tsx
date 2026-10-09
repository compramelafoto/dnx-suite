"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { filterRanking, type WorkDecision } from "@repo/muestras";
import { botonFino, botonLleno, campo } from "@/components/convocatorias/estilos";
import { armarMuestra, decidir } from "@/lib/seleccion/acciones";
import type { FilaSeleccion } from "@/lib/seleccion/consultas";

const DECISION: Record<WorkDecision, string> = { PENDING: "Sin decidir", SELECTED: "Elegida", DISCARDED: "Descartada" };

export function TablaSeleccion({ callId, estado, filas, lugar, yaArmada, muestraId }: {
  callId: string; estado: string; filas: FilaSeleccion[]; lugar: number; yaArmada: boolean; muestraId: string;
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [minimo, setMinimo] = useState("");
  const [cual, setCual] = useState<WorkDecision | "ALL">("ALL");
  const visibles = useMemo(
    () => filterRanking(filas, { minAverage: minimo === "" ? null : Number(minimo), decision: cual }),
    [filas, minimo, cual],
  );
  const curando = estado === "CURATING";
  const elegidas = filas.filter((f) => f.decision === "SELECTED").length;
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>) =>
    start(async () => {
      const r = await f();
      setError(r.ok ? null : (r.errores ?? []).join(" "));
      if (r.ok) router.refresh();
    });

  return (
    <section aria-label="Obras" className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          <span className="block text-sm">Promedio mínimo</span>
          <select value={minimo} onChange={(e) => setMinimo(e.target.value)} className={`${campo} w-40`}>
            <option value="">Todas</option>
            {["4.5", "4", "3.5", "3", "2"].map((v) => <option key={v} value={v}>{v.replace(".", ",")} o más</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm">Decisión</span>
          <select value={cual} onChange={(e) => setCual(e.target.value as WorkDecision | "ALL")} className={`${campo} w-44`}>
            <option value="ALL">Todas</option>
            <option value="PENDING">Sin decidir</option>
            <option value="SELECTED">Elegidas</option>
            <option value="DISCARDED">Descartadas</option>
          </select>
        </label>
        <p className="text-[15px]">{elegidas} {elegidas === 1 ? "elegida" : "elegidas"}{curando ? `. Lugar para ${lugar} más en la muestra.` : "."}</p>
      </div>

      {error ? <p className="text-[var(--mf-alerta)]">{error}</p> : null}

      <ol className="border-t border-[var(--mf-line)]">
        {visibles.map((f) => (
          <li key={f.workId} className="grid gap-4 border-b border-[var(--mf-line)] py-5 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.imagePath} alt={`Obra ${f.code}`} loading="lazy" className="aspect-square w-40 bg-[var(--mf-surface)] object-contain" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-[var(--mf-muted)]">{f.code}</p>
              <p className="mf-titulo text-xl">{f.title}</p>
              <p className="text-[13px] text-[var(--mf-muted)]">{[f.year, f.technique].filter(Boolean).join(". ")}</p>
              {f.authorName ? <p className="text-[15px]">{f.authorName}</p> : null}
              {f.statement ? <p className="text-[15px] leading-snug">{f.statement}</p> : null}
              {f.notes.length ? (
                <details className="text-[15px]">
                  <summary className="cursor-pointer text-sm text-[var(--mf-muted)]">{f.notes.length === 1 ? "1 nota del equipo" : `${f.notes.length} notas del equipo`}</summary>
                  <ul className="mt-2 space-y-1">{f.notes.map((n, i) => <li key={i} className="border-l-2 border-[var(--mf-line)] pl-3">{n}</li>)}</ul>
                </details>
              ) : null}
            </div>
            <div className="space-y-2 sm:text-right">
              <p className="mf-titulo text-3xl tabular-nums">{f.average == null ? "—" : f.average.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p>
              <p className="text-[13px] text-[var(--mf-muted)]">{f.count} {f.count === 1 ? "puntaje" : "puntajes"}</p>
              <p className="text-sm">{DECISION[f.decision]}</p>
              {curando ? (
                <div className="flex gap-3 sm:justify-end">
                  {f.decision !== "SELECTED" ? <button type="button" disabled={pendiente} className="text-sm underline" onClick={() => correr(() => decidir(f.workId, "SELECTED"))}>Seleccionar</button> : null}
                  {f.decision !== "DISCARDED" ? <button type="button" disabled={pendiente} className="text-sm underline" onClick={() => correr(() => decidir(f.workId, "DISCARDED"))}>Descartar</button> : null}
                  {f.decision !== "PENDING" ? <button type="button" disabled={pendiente} className="text-sm text-[var(--mf-muted)] underline" onClick={() => correr(() => decidir(f.workId, "PENDING"))}>Deshacer</button> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {visibles.length === 0 ? <p className="text-[var(--mf-muted)]">No hay obras con ese filtro.</p> : null}

      {estado === "DONE" ? (
        yaArmada ? (
          <p className="text-[15px]">Las obras elegidas ya están en la muestra. <Link href={`/panel/muestras/${muestraId}`} className="underline underline-offset-[6px]">Editar la muestra</Link></p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              disabled={pendiente || elegidas === 0}
              className={botonLleno}
              onClick={() => {
                if (!window.confirm(`Se agregan ${elegidas} obras a la galería de la muestra, con el nombre de cada autor. Después podés ordenarlas y elegir destacadas en el editor.`)) return;
                correr(() => armarMuestra(callId));
              }}
            >
              Armar la muestra
            </button>
            <p className="text-sm text-[var(--mf-muted)]">Las mejor puntuadas quedan como destacadas hasta completar 12.</p>
          </div>
        )
      ) : (
        <Link href={`/panel/convocatorias/${callId}`} className={botonFino}>Volver a la convocatoria</Link>
      )}
    </section>
  );
}
