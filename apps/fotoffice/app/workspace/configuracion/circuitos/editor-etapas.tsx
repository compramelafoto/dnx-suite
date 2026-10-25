"use client";

import { useActionState, useOptimistic, useState, useTransition, type DragEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import type { CircuitoConfig, EtapaConfig, TareaModeloConfig } from "@/lib/circuitos/configuracion";
import { ESTADOS_CAPTACION, ETIQUETA_EVENTO, EVENTOS, EVENTOS_CONECTADOS } from "@/lib/circuitos/constantes";
import { claseDeColorEtiqueta, NOMBRES_DE_COLOR } from "@/lib/ficha/formato";
import {
  archivarEtapaAction,
  borrarEtapaAction,
  crearEtapaAction,
  desarchivarEtapaAction,
  editarEtapaAction,
  guardarReglasAction,
  guardarTareasModeloAction,
  reordenarEtapasAction,
  type EstadoCircuitos,
} from "./actions";
import { Mensaje } from "../ficha/mensaje";

const INICIAL: EstadoCircuitos = { error: null };

const ESTADO_CAPTACION: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUOTED: "Presupuestado",
  INTERESTED: "Interesado",
};

function textoDias(d: number): string {
  if (d === 0) return "sin vencimiento";
  return d === 1 ? "vence en 1 día" : `vence en ${d} días`;
}

/** Mueve `id` al lugar de `destino` (antes si sube, después si baja). */
function moverEn(ids: string[], id: string, destino: number): string[] {
  const sin = ids.filter((x) => x !== id);
  const i = Math.max(0, Math.min(destino, sin.length));
  return [...sin.slice(0, i), id, ...sin.slice(i)];
}

function confirmarBorrado(nombre: string) {
  return (e: { preventDefault: () => void }) => {
    if (!window.confirm(`¿Borrar la etapa "${nombre}"? No se puede deshacer.`)) e.preventDefault();
  };
}

// ─── Datos de la etapa ───────────────────────────────────────────────────────

async function despacharEtapa(prev: EstadoCircuitos, fd: FormData): Promise<EstadoCircuitos> {
  switch (fd.get("_accion")) {
    case "guardar":
      return editarEtapaAction(prev, fd);
    case "archivar":
      return archivarEtapaAction(prev, fd);
    case "desarchivar":
      return desarchivarEtapaAction(prev, fd);
    case "borrar":
      return borrarEtapaAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

function DatosEtapa({ e, venta, unica }: { e: EtapaConfig; venta: boolean; unica: boolean }) {
  const [estado, enviar, pendiente] = useActionState(despacharEtapa, INICIAL);
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="id" value={e.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`et-nombre-${e.id}`}>
            Nombre
          </label>
          <input id={`et-nombre-${e.id}`} name="nombre" defaultValue={e.name} maxLength={40} required className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`et-dias-${e.id}`}>
            Días para vencer (0 = nunca)
          </label>
          <input
            id={`et-dias-${e.id}`}
            name="dias"
            type="number"
            min={0}
            max={365}
            defaultValue={e.days}
            required
            className="fo-input"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`et-color-${e.id}`}>
            Color
          </label>
          <select id={`et-color-${e.id}`} name="color" defaultValue={e.color} className="fo-input">
            {Object.entries(NOMBRES_DE_COLOR).map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="exigeTareas" value="1" defaultChecked={e.requireTasks} />
        Exige tareas completas: no se puede pasar de etapa con tareas obligatorias pendientes
      </label>
      {venta ? (
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor={`et-estado-${e.id}`}>
            Estado equivalente en Consultas
          </label>
          <select id={`et-estado-${e.id}`} name="estadoCaptacion" defaultValue={e.leadStatus ?? ""} className="fo-input">
            <option value="">Ninguno (no cambia el estado)</option>
            {ESTADOS_CAPTACION.map((s) => (
              <option key={s} value={s}>
                {ESTADO_CAPTACION[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="_accion" value="guardar" className="fo-btn fo-btn-primary text-xs" disabled={pendiente}>
          Guardar etapa
        </button>
        <button
          type="submit"
          name="_accion"
          value="archivar"
          className="fo-btn fo-btn-ghost text-xs"
          disabled={pendiente || unica}
          title={unica ? "Tiene que quedar al menos una etapa activa" : undefined}
        >
          Archivar
        </button>
        <button
          type="submit"
          name="_accion"
          value="borrar"
          className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
          disabled={pendiente || unica}
          onClick={confirmarBorrado(e.name)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Borrar
        </button>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">
        Archivar la saca de la lista para registros nuevos y conserva el historial. Sólo se puede borrar una etapa que nunca
        se usó.
      </p>
      <Mensaje estado={estado} />
    </form>
  );
}

// ─── Tareas modelo ───────────────────────────────────────────────────────────

type TareaFila = TareaModeloConfig & { clave: number };

function TareasModelo({ e }: { e: EtapaConfig }) {
  const [estado, enviar, pendiente] = useActionState(guardarTareasModeloAction, INICIAL);
  const [filas, setFilas] = useState<TareaFila[]>(() => e.tareas.map((t, i) => ({ ...t, clave: i })));
  const [siguiente, setSiguiente] = useState(e.tareas.length);
  const cambiar = (clave: number, parte: Partial<TareaModeloConfig>) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...parte } : f)));
  const lista = filas.map(({ title, days, required }) => ({ title, days, required }));
  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={e.id} />
      <input type="hidden" name="tareas" value={JSON.stringify(lista)} />
      <h4 className="text-sm font-semibold">Tareas que se crean al entrar</h4>
      {filas.length === 0 ? <p className="text-xs text-[var(--fo-muted)]">Ninguna.</p> : null}
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={f.clave} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`tm-${e.id}-${f.clave}`}>
              Tarea {i + 1}
            </label>
            <input
              id={`tm-${e.id}-${f.clave}`}
              value={f.title}
              onChange={(ev) => cambiar(f.clave, { title: ev.target.value })}
              maxLength={120}
              required
              className="fo-input min-w-0 flex-1"
              placeholder="Por ejemplo: Llamar al cliente"
            />
            <label className="flex items-center gap-1 text-xs">
              Días
              <input
                type="number"
                min={0}
                max={365}
                value={f.days}
                onChange={(ev) => cambiar(f.clave, { days: Math.max(0, Math.trunc(Number(ev.target.value) || 0)) })}
                className="fo-input w-20"
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={f.required} onChange={(ev) => cambiar(f.clave, { required: ev.target.checked })} />
              Obligatoria
            </label>
            <button
              type="button"
              className="fo-icon-btn"
              onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
              aria-label={`Quitar la tarea ${f.title || i + 1}`}
              title="Quitar"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="fo-btn fo-btn-ghost text-xs"
          onClick={() => {
            setFilas((fs) => [...fs, { title: "", days: 0, required: false, clave: siguiente }]);
            setSiguiente((n) => n + 1);
          }}
          disabled={filas.length >= 30}
        >
          <Plus className="size-3.5" aria-hidden />
          Agregar tarea
        </button>
        <button type="submit" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
          Guardar tareas
        </button>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">Cambiar esta lista no toca las tareas que ya se crearon.</p>
      <Mensaje estado={estado} />
    </form>
  );
}

// ─── Avance automático ───────────────────────────────────────────────────────

function Reglas({ e }: { e: EtapaConfig }) {
  const [estado, enviar, pendiente] = useActionState(guardarReglasAction, INICIAL);
  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={e.id} />
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">Avanza sola a esta etapa cuando…</legend>
        {EVENTOS.map((ev) => {
          const conectado = EVENTOS_CONECTADOS.includes(ev);
          return (
            <label key={ev} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="checkbox" name="evento" value={ev} defaultChecked={e.reglas.includes(ev)} />
              {ETIQUETA_EVENTO[ev]}
              {conectado ? null : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Todavía no conectado</span>
              )}
            </label>
          );
        })}
      </fieldset>
      <button type="submit" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
        Guardar avance automático
      </button>
      <p className="text-xs text-[var(--fo-muted)]">Sólo avanza hacia adelante: nunca hace retroceder un registro.</p>
      <Mensaje estado={estado} />
    </form>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function EtapaArchivada({ e }: { e: EtapaConfig }) {
  const [estado, enviar, pendiente] = useActionState(despacharEtapa, INICIAL);
  return (
    <li className="space-y-1 py-2">
      <form action={enviar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={e.id} />
        <span className={`rounded-full px-2 py-0.5 text-xs ${claseDeColorEtiqueta(e.color)}`}>{e.name}</span>
        <button type="submit" name="_accion" value="desarchivar" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente}>
          Volver a activar
        </button>
        <button
          type="submit"
          name="_accion"
          value="borrar"
          className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
          disabled={pendiente}
          onClick={confirmarBorrado(e.name)}
        >
          Borrar
        </button>
      </form>
      <Mensaje estado={estado} />
    </li>
  );
}

function NuevaEtapa({ circuitoId }: { circuitoId: string }) {
  const [estado, crear, creando] = useActionState(crearEtapaAction, INICIAL);
  return (
    <form action={crear} className="space-y-2">
      <input type="hidden" name="circuitoId" value={circuitoId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="fo-field-stack min-w-0 flex-1">
          <label className="fo-label" htmlFor="et-nueva">
            Nueva etapa
          </label>
          <input id="et-nueva" name="nombre" maxLength={40} required className="fo-input" placeholder="Por ejemplo: Seña cobrada" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="et-nueva-dias">
            Días
          </label>
          <input id="et-nueva-dias" name="dias" type="number" min={0} max={365} defaultValue={0} className="fo-input w-24" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="et-nueva-color">
            Color
          </label>
          <select id="et-nueva-color" name="color" defaultValue="gris" className="fo-input">
            {Object.entries(NOMBRES_DE_COLOR).map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={creando}>
          <Plus className="size-4" aria-hidden />
          Agregar al final
        </button>
      </div>
      <Mensaje estado={estado} />
    </form>
  );
}

export function EditorEtapas({ circuito }: { circuito: CircuitoConfig }) {
  const activas = circuito.etapas.filter((e) => !e.archivada);
  const archivadas = circuito.etapas.filter((e) => e.archivada);
  const porId = new Map(circuito.etapas.map((e) => [e.id, e]));
  const [orden, setOrden] = useOptimistic(activas.map((e) => e.id));
  const [estadoOrden, setEstadoOrden] = useState<EstadoCircuitos>(INICIAL);
  const [guardando, startTransition] = useTransition();
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const venta = circuito.kind === "VENTA";

  function guardarOrden(nuevo: string[]) {
    if (nuevo.join() === orden.join()) return;
    startTransition(async () => {
      setOrden(nuevo);
      const fd = new FormData();
      fd.set("circuitoId", circuito.id);
      for (const id of nuevo) fd.append("etapa", id);
      const r = await reordenarEtapasAction(undefined, fd);
      setEstadoOrden(r);
    });
  }

  function alSoltar(ev: DragEvent, destinoId: string) {
    ev.preventDefault();
    const id = arrastrada ?? ev.dataTransfer.getData("text/plain");
    setArrastrada(null);
    setSobre(null);
    if (!id || id === destinoId || !orden.includes(id)) return;
    guardarOrden(moverEn(orden, id, orden.indexOf(destinoId)));
  }

  return (
    <section id="etapas" className="fo-card space-y-4 p-5" aria-labelledby="et-titulo">
      <div className="space-y-1">
        <h2 id="et-titulo" className="text-base font-semibold">
          Etapas de “{circuito.name}”
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Arrastrá las etapas o usá las flechas para cambiar el orden. Cambiar el orden no mueve ningún registro de su etapa.
        </p>
      </div>
      <ol className="space-y-2" aria-busy={guardando}>
        {orden.map((id, i) => {
          const e = porId.get(id);
          if (!e) return null;
          return (
            <li
              key={id}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "move";
                if (sobre !== id) setSobre(id);
              }}
              onDrop={(ev) => alSoltar(ev, id)}
              className={`rounded-lg border bg-[var(--fo-surface,white)] ${
                sobre === id && arrastrada !== id ? "border-[var(--fo-accent,#1d4ed8)]" : "border-[var(--fo-border)]"
              } ${arrastrada === id ? "opacity-50" : ""}`}
            >
              <details>
                {/* Sólo el encabezado se arrastra: así los campos de adentro se pueden seleccionar. */}
                <summary
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.effectAllowed = "move";
                    ev.dataTransfer.setData("text/plain", id);
                    setArrastrada(id);
                  }}
                  onDragEnd={() => {
                    setArrastrada(null);
                    setSobre(null);
                  }}
                  className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3"
                >
                  <GripVertical className="size-4 cursor-grab text-[var(--fo-muted)]" aria-hidden />
                  <span className="w-6 text-right text-xs text-[var(--fo-muted)]">{i + 1}.</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(e.color)}`}>{e.name}</span>
                  <span className="text-xs text-[var(--fo-muted)]">
                    {textoDias(e.days)}
                    {e.tareas.length ? ` · ${e.tareas.length === 1 ? "1 tarea" : `${e.tareas.length} tareas`}` : ""}
                    {e.reglas.length ? " · avanza sola" : ""}
                    {e.requireTasks ? " · exige tareas" : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      className="fo-icon-btn"
                      disabled={guardando || i === 0}
                      onClick={(ev) => {
                        ev.preventDefault();
                        guardarOrden(moverEn(orden, id, i - 1));
                      }}
                      aria-label={`Subir ${e.name}`}
                      title="Subir"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="fo-icon-btn"
                      disabled={guardando || i === orden.length - 1}
                      onClick={(ev) => {
                        ev.preventDefault();
                        guardarOrden(moverEn(orden, id, i + 1));
                      }}
                      aria-label={`Bajar ${e.name}`}
                      title="Bajar"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </span>
                </summary>
                <div className="space-y-5 border-t border-[var(--fo-border)] p-4">
                  <DatosEtapa e={e} venta={venta} unica={orden.length === 1} />
                  <TareasModelo e={e} />
                  <Reglas e={e} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      <Mensaje estado={estadoOrden} />
      <NuevaEtapa circuitoId={circuito.id} />
      {archivadas.length ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Archivadas</h3>
          <ul className="divide-y divide-[var(--fo-border)]">
            {archivadas.map((e) => (
              <EtapaArchivada key={e.id} e={e} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
