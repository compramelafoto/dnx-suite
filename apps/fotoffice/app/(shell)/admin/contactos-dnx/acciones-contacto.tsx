"use client";

import { useState, useTransition } from "react";
import { ESTADOS_CONTACTO } from "@/lib/agentes/buscador/tipos";
import { ETIQUETA_ESTADO, etiquetaCampo } from "@/lib/agentes/buscador/etiquetas";
import {
  agregarNotaAction,
  buscarParaFusionarAction,
  cambiarEstadoAction,
  editarDatoAction,
  fusionarAction,
  importarConocidosAction,
  type CandidatoFusion,
  type EstadoAccionContactos,
} from "./actions";

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
  return { estado, enCurso, correr, setEstado };
}

/** «Importar conocidos»: los clientes de DNX Estudio con la etiqueta «Fotógrafo». */
export function BotonImportarConocidos() {
  const { estado, enCurso, correr } = useAccion();
  return (
    <div className="space-y-2">
      <button type="button" className="fo-btn-secondary" disabled={enCurso} onClick={() => correr(importarConocidosAction)}>
        {enCurso ? "Importando… (puede tardar un minuto)" : "Importar conocidos"}
      </button>
      <Aviso estado={estado} />
    </div>
  );
}

/** Selector de estado. «No contactar» (ponerlo o sacarlo) pide confirmación. */
export function SelectorEstado({ id, estado: actual }: { id: string; estado: string }) {
  const [elegido, setElegido] = useState(actual);
  const { estado, enCurso, correr } = useAccion();

  function guardar() {
    if (elegido === actual) return;
    if (elegido === "NO_CONTACTAR" && !window.confirm("¿Marcar como «No contactar»? Ningún agente le va a escribir nunca más.")) return;
    const saliendo = actual === "NO_CONTACTAR";
    if (saliendo && !window.confirm("Este contacto pidió no ser contactado. ¿Seguro que querés cambiarlo? Queda registrado a tu nombre.")) return;
    correr(() => cambiarEstadoAction(id, elegido, saliendo));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`estado-${id}`}>
          Estado
        </label>
        <select id={`estado-${id}`} className="fo-input w-auto" value={elegido} onChange={(e) => setElegido(e.target.value)} disabled={enCurso}>
          {ESTADOS_CONTACTO.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </select>
        <button type="button" className="fo-btn-primary" disabled={enCurso || elegido === actual} onClick={guardar}>
          {enCurso ? "Guardando…" : "Cambiar estado"}
        </button>
      </div>
      <Aviso estado={estado} />
    </div>
  );
}

/** Un dato de la ficha (web, Instagram, correo…) editable. Vacío lo borra. */
export function EditarDato({ id, campo, valor }: { id: string; campo: string; valor: string | null }) {
  const [texto, setTexto] = useState(valor ?? "");
  const { estado, enCurso, correr } = useAccion();
  const cambio = texto.trim() !== (valor ?? "");

  function guardar() {
    if (texto.trim() === "" && valor && !window.confirm(`¿Borrar ${etiquetaCampo(campo).toLowerCase()} de la ficha? El historial de dónde salió queda.`)) return;
    correr(() => editarDatoAction(id, campo, texto));
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="fo-input flex-1 min-w-[12rem]"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="(sin dato)"
          aria-label={etiquetaCampo(campo)}
          disabled={enCurso}
        />
        <button type="button" className="fo-btn-secondary" disabled={enCurso || !cambio} onClick={guardar}>
          {enCurso ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <Aviso estado={estado} />
    </div>
  );
}

export function NotaNueva({ id }: { id: string }) {
  const [texto, setTexto] = useState("");
  const { estado, enCurso, correr } = useAccion();
  return (
    <div className="space-y-2">
      <textarea
        className="fo-input min-h-20"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Por ejemplo: lo llamé, me dijo que lo vuelva a contactar en marzo."
        aria-label="Nota nueva"
        disabled={enCurso}
      />
      <button
        type="button"
        className="fo-btn-primary"
        disabled={enCurso || texto.trim() === ""}
        onClick={() =>
          correr(async () => {
            const r = await agregarNotaAction(id, texto);
            if (r?.ok) setTexto("");
            return r;
          })
        }
      >
        {enCurso ? "Guardando…" : "Agregar nota"}
      </button>
      <Aviso estado={estado} />
    </div>
  );
}

/**
 * «Fusionar con…»: se busca el otro contacto (por nombre, ciudad, correo, Instagram o su id) y, al
 * confirmar, ese contacto se suma a esta ficha.
 */
export function FusionarCon({ id }: { id: string }) {
  const [busqueda, setBusqueda] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoFusion[] | null>(null);
  const { estado, enCurso, correr } = useAccion();
  const [buscando, startBuscar] = useTransition();

  function buscar() {
    startBuscar(async () => {
      setCandidatos(await buscarParaFusionarAction(id, busqueda));
    });
  }

  function fusionarCon(c: CandidatoFusion) {
    if (!window.confirm(`¿Fusionar «${c.nombre}» en esta ficha? Sus datos y su historia pasan acá y deja de aparecer en la lista. No se puede deshacer.`)) return;
    correr(async () => {
      const r = await fusionarAction(id, c.id);
      if (r?.ok) setCandidatos(null);
      return r;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="fo-input flex-1 min-w-[12rem]"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Nombre, ciudad, correo, Instagram o id del otro contacto"
          aria-label="Buscar el contacto con el que fusionar"
        />
        <button type="button" className="fo-btn-secondary" disabled={buscando || busqueda.trim() === ""} onClick={buscar}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {candidatos !== null ? (
        candidatos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">No encontré otro contacto con eso.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {candidatos.map((c) => (
              <li key={c.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-[var(--fo-text)] font-medium">{c.nombre}</span>
                  {c.detalle ? <span className="text-[var(--fo-muted)]"> · {c.detalle}</span> : null}
                </span>
                <button type="button" className="fo-btn-secondary" disabled={enCurso} onClick={() => fusionarCon(c)}>
                  Fusionar acá
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <Aviso estado={estado} />
    </div>
  );
}
