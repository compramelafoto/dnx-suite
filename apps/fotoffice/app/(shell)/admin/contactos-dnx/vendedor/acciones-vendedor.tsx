"use client";

import { useState, useTransition } from "react";
import {
  correrVendedorAction,
  guardarAjustesVendedorAction,
  pausarVendedorAction,
  pedirModeloNuevoAction,
  probarConContactoAction,
  type EstadoAccionContactos,
} from "../actions";

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

/** «Pausar» / «Reanudar» y «Correr ahora». Si no se puede reanudar, el aviso dice por qué. */
export function ControlesVendedor({ pausado }: { pausado: boolean }) {
  const { estado, enCurso, correr } = useAccion();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="fo-btn fo-btn-primary" disabled={enCurso} onClick={() => correr(() => pausarVendedorAction(!pausado))}>
          {pausado ? "Reanudar" : "Pausar"}
        </button>
        <button type="button" className="fo-btn fo-btn-secondary" disabled={enCurso} onClick={() => correr(correrVendedorAction)}>
          Correr ahora
        </button>
      </div>
      <Aviso estado={estado} />
    </div>
  );
}

/** Tope de Claude (USD por mes, 0 a 500) y correos por día (0 a 50). */
export function FormAjustesVendedor(p: { topeClaudeUsd: number; correosPorDia: number; correosPrimeraSemana: number }) {
  const [tope, setTope] = useState(String(p.topeClaudeUsd).replace(".", ","));
  const [porDia, setPorDia] = useState(String(p.correosPorDia));
  const [primeraSemana, setPrimeraSemana] = useState(String(p.correosPrimeraSemana));
  const { estado, enCurso, correr } = useAccion();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => guardarAjustesVendedorAction(tope, porDia, primeraSemana));
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="fo-label">Tope de Claude (USD por mes)</span>
          <input value={tope} onChange={(e) => setTope(e.target.value)} inputMode="decimal" className="fo-input w-32" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="fo-label">Correos por día</span>
          <input value={porDia} onChange={(e) => setPorDia(e.target.value)} inputMode="numeric" className="fo-input w-24" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="fo-label">Correos por día la primera semana</span>
          <input value={primeraSemana} onChange={(e) => setPrimeraSemana(e.target.value)} inputMode="numeric" className="fo-input w-24" />
        </label>
        <button type="submit" className="fo-btn fo-btn-secondary" disabled={enCurso}>
          {enCurso ? "Guardando…" : "Guardar ajustes"}
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

/** «Pedir modelo nuevo» de un grupo: Claude lo redacta y llega por Telegram (puede tardar un par de minutos). */
export function BotonPedirModelo({ grupo }: { grupo: string }) {
  const { estado, enCurso, correr } = useAccion();
  return (
    <div className="space-y-1">
      <button type="button" className="fo-btn fo-btn-ghost" disabled={enCurso} onClick={() => correr(() => pedirModeloNuevoAction(grupo))}>
        {enCurso ? "Redactando… (puede tardar un par de minutos)" : "Pedir modelo nuevo"}
      </button>
      <Aviso estado={estado} />
    </div>
  );
}

/** El contacto de prueba: con uno puesto, el Vendedor sólo le escribe a ése. */
export function FormContactoPrueba({ actual }: { actual: string | null }) {
  const [id, setId] = useState(actual ?? "");
  const { estado, enCurso, correr } = useAccion();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => probarConContactoAction(id));
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="fo-label">Id del contacto de prueba</span>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Vacío: cola normal" className="fo-input w-72" />
        </label>
        <button type="submit" className="fo-btn fo-btn-secondary" disabled={enCurso}>
          Guardar
        </button>
        {actual ? (
          <button
            type="button"
            className="fo-btn fo-btn-ghost"
            disabled={enCurso}
            onClick={() => {
              setId("");
              correr(() => probarConContactoAction(""));
            }}
          >
            Sacar el contacto de prueba
          </button>
        ) : null}
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

/** En la ficha: usar este contacto como el único al que le escribe el Vendedor (o dejar de usarlo). */
export function BotonContactoPrueba({ id, activo }: { id: string; activo: boolean }) {
  const { estado, enCurso, correr } = useAccion();
  return (
    <div className="space-y-2">
      <button type="button" className="fo-btn fo-btn-secondary" disabled={enCurso} onClick={() => correr(() => probarConContactoAction(activo ? "" : id))}>
        {activo ? "Dejar de usarlo de prueba" : "Usar de contacto de prueba del Vendedor"}
      </button>
      <Aviso estado={estado} />
    </div>
  );
}
