"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { etiquetaEstadoRegion } from "@/lib/agentes/buscador/etiquetas";
import {
  activarRegionAction,
  correrBuscadorAction,
  guardarTopesAction,
  pausarBuscadorAction,
  reordenarRegionesAction,
  type EstadoAccionContactos,
} from "./actions";

/** Lo que la cabecera le pasa de cada región (sólo datos serializables). */
export type RegionPanel = { region: string; nombre: string; estado: string; hechas: number; total: number; fallidas: number };

function Aviso({ estado }: { estado: EstadoAccionContactos }) {
  if (!estado) return null;
  return (
    <div className={estado.ok ? "fo-alert-success" : "fo-alert-error"} role="status">
      {estado.mensaje}
    </div>
  );
}

/** Corre una acción del servidor y guarda su resultado para mostrarlo. */
function useAccion() {
  const [estado, setEstado] = useState<EstadoAccionContactos>(null);
  const [enCurso, startTransition] = useTransition();
  const correr = (fn: () => Promise<EstadoAccionContactos>) =>
    startTransition(async () => {
      setEstado(await fn());
    });
  return { estado, enCurso, correr };
}

/** «Pausar» / «Reanudar» y «Correr ahora». */
export function ControlesBuscador({ pausado }: { pausado: boolean }) {
  const { estado, enCurso, correr } = useAccion();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="fo-btn-primary" disabled={enCurso || pausado} onClick={() => correr(correrBuscadorAction)}>
          Correr ahora
        </button>
        <button type="button" className="fo-btn-secondary" disabled={enCurso} onClick={() => correr(() => pausarBuscadorAction(!pausado))}>
          {pausado ? "Reanudar" : "Pausar"}
        </button>
      </div>
      {pausado ? <p className="text-xs text-[var(--fo-muted)]">En pausa: no busca nada hasta que lo reanudes.</p> : null}
      <Aviso estado={estado} />
    </div>
  );
}

/** Topes de gasto del mes por fuente, en USD (0 a 500). */
export function FormTopes({ topeGoogleUsd, topeClaudeUsd }: { topeGoogleUsd: number; topeClaudeUsd: number }) {
  const [google, setGoogle] = useState(String(topeGoogleUsd).replace(".", ","));
  const [claude, setClaude] = useState(String(topeClaudeUsd).replace(".", ","));
  const { estado, enCurso, correr } = useAccion();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => guardarTopesAction(google, claude));
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="fo-label">Tope de Google (USD por mes)</span>
          <input value={google} onChange={(e) => setGoogle(e.target.value)} inputMode="decimal" className="fo-input w-32" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="fo-label">Tope de Claude (USD por mes)</span>
          <input value={claude} onChange={(e) => setClaude(e.target.value)} inputMode="decimal" className="fo-input w-32" />
        </label>
        <button type="submit" className="fo-btn-secondary" disabled={enCurso}>
          {enCurso ? "Guardando…" : "Guardar topes"}
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

/** Las regiones en orden, con su avance. Se pueden activar, reabrir (las completas) y reordenar (las que no lo están). */
export function ListaRegiones({ regiones }: { regiones: RegionPanel[] }) {
  const { estado, enCurso, correr } = useAccion();
  const movibles = regiones.filter((r) => r.estado !== "COMPLETA").map((r) => r.region);

  function mover(region: string, paso: -1 | 1) {
    const i = movibles.indexOf(region);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= movibles.length) return;
    const nuevo = [...movibles];
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    correr(() => reordenarRegionesAction(nuevo));
  }

  function reabrir(r: RegionPanel) {
    if (!window.confirm(`¿Reabrir ${r.nombre}? Queda en curso y las búsquedas que fallaron se vuelven a intentar (gasta dinero de los topes).`)) return;
    correr(() => activarRegionAction(r.region, true));
  }

  return (
    <div className="space-y-2">
      <ol className="divide-y divide-[var(--fo-border)] text-sm">
        {regiones.map((r) => {
          const i = movibles.indexOf(r.region);
          return (
            <li key={r.region} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-40 font-medium text-[var(--fo-text)]">{r.nombre}</span>
              <span className={r.estado === "EN_CURSO" ? "text-[var(--fo-accent)] font-medium" : "text-[var(--fo-muted)]"}>
                {etiquetaEstadoRegion(r.estado)}
              </span>
              <span className="text-[var(--fo-muted)]">
                {r.total > 0 ? `${r.hechas}/${r.total} búsquedas` : "sin búsquedas todavía"}
                {r.fallidas > 0 ? ` · ${r.fallidas} ${r.fallidas === 1 ? "falló" : "fallaron"}` : ""}
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {r.estado === "EN_ESPERA" || r.estado === "PAUSADA" ? (
                  <button type="button" className="fo-btn-ghost" disabled={enCurso} onClick={() => correr(() => activarRegionAction(r.region, false))}>
                    Activar
                  </button>
                ) : null}
                {r.estado === "COMPLETA" ? (
                  <button type="button" className="fo-btn-ghost" disabled={enCurso} onClick={() => reabrir(r)}>
                    Reabrir
                  </button>
                ) : null}
                {i >= 0 ? (
                  <>
                    <button type="button" className="fo-btn-ghost" disabled={enCurso || i === 0} onClick={() => mover(r.region, -1)} title="Subir">
                      <ArrowUp className="size-4" aria-label="Subir" />
                    </button>
                    <button
                      type="button"
                      className="fo-btn-ghost"
                      disabled={enCurso || i === movibles.length - 1}
                      onClick={() => mover(r.region, 1)}
                      title="Bajar"
                    >
                      <ArrowDown className="size-4" aria-label="Bajar" />
                    </button>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <Aviso estado={estado} />
    </div>
  );
}
