"use client";

import { useActionState, useState } from "react";
import { MAX_NOMBRE_PLANTILLA, MAX_PLANTILLAS, MAX_TAREAS_PLANTILLA, MAX_TEXTO_TAREA } from "@/lib/pedidos/checklist-plantillas";
import { guardarPlantillasChecklistAction, type EstadoPedidosConfig } from "./actions";

type Fila = { clave: number; nombre: string; tareas: string };

const INICIAL: EstadoPedidosConfig = { error: null };

/**
 * Editor de plantillas de checklist: cada plantilla tiene un nombre y una tarea por línea. Al
 * guardar se mandan todas juntas (JSON) y el servidor valida topes, nombres y textos.
 */
export function PlantillasChecklistForm({ plantillas }: { plantillas: { name: string; tasks: string[] }[] }) {
  const [estado, guardar, guardando] = useActionState(guardarPlantillasChecklistAction, INICIAL);
  const [filas, setFilas] = useState<Fila[]>(() => plantillas.map((p, i) => ({ clave: i, nombre: p.name, tareas: p.tasks.join("\n") })));
  const [siguiente, setSiguiente] = useState(plantillas.length);

  const json = JSON.stringify(
    filas.map((f) => ({
      name: f.nombre.trim(),
      tasks: f.tareas
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    })),
  );

  function cambiar(clave: number, parte: Partial<Fila>) {
    setFilas(filas.map((f) => (f.clave === clave ? { ...f, ...parte } : f)));
  }

  return (
    <form action={guardar} className="space-y-4">
      <input type="hidden" name="plantillas" value={json} />
      {filas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay plantillas: los pedidos nuevos nacen sin checklist.</p> : null}
      {filas.map((f, i) => {
        const cantidad = f.tareas.split("\n").filter((t) => t.trim().length > 0).length;
        return (
          <fieldset key={f.clave} className="space-y-3 rounded-md border border-[var(--fo-border)] p-4">
            <legend className="px-1 text-xs text-[var(--fo-muted)]">{i === 0 ? "Plantilla 1 (la que se elige por omisión)" : `Plantilla ${i + 1}`}</legend>
            <div className="fo-field-stack max-w-sm">
              <label className="fo-label" htmlFor={`checklist-nombre-${f.clave}`}>
                Nombre
              </label>
              <input
                id={`checklist-nombre-${f.clave}`}
                className="fo-input"
                value={f.nombre}
                maxLength={MAX_NOMBRE_PLANTILLA}
                onChange={(e) => cambiar(f.clave, { nombre: e.target.value })}
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`checklist-tareas-${f.clave}`}>
                Tareas (una por línea)
              </label>
              <textarea
                id={`checklist-tareas-${f.clave}`}
                className="fo-input min-h-32 font-sans"
                value={f.tareas}
                onChange={(e) => cambiar(f.clave, { tareas: e.target.value })}
                aria-describedby={`checklist-ayuda-${f.clave}`}
              />
              <p id={`checklist-ayuda-${f.clave}`} className="text-xs text-[var(--fo-muted)]">
                {cantidad} de {MAX_TAREAS_PLANTILLA} tareas, de hasta {MAX_TEXTO_TAREA} caracteres cada una.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setFilas(filas.filter((x) => x.clave !== f.clave))}>
                Quitar plantilla
              </button>
              {i > 0 ? (
                <button
                  type="button"
                  className="fo-btn fo-btn-ghost text-sm"
                  onClick={() => {
                    const copia = [...filas];
                    [copia[i - 1], copia[i]] = [copia[i]!, copia[i - 1]!];
                    setFilas(copia);
                  }}
                >
                  Subir
                </button>
              ) : null}
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          disabled={filas.length >= MAX_PLANTILLAS}
          onClick={() => {
            setFilas([...filas, { clave: siguiente, nombre: "", tareas: "" }]);
            setSiguiente(siguiente + 1);
          }}
        >
          Agregar plantilla
        </button>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          Guardar plantillas
        </button>
        {filas.length >= MAX_PLANTILLAS ? <span className="text-xs text-[var(--fo-muted)]">Máximo {MAX_PLANTILLAS} plantillas.</span> : null}
      </div>
      <div aria-live="polite">
        {estado?.error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {estado.error}
          </p>
        ) : estado?.ok ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">
            {estado.ok}
          </p>
        ) : null}
      </div>
    </form>
  );
}
