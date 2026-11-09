"use client";

import { useActionState, useState } from "react";
import { guardarCajaAction, type BoxActionState } from "@/app/actions/box-mensual";
import type { MaterialBox } from "@/lib/box-mensual/secuencia";

const initial: BoxActionState = { error: null };

type CajaInicial = {
  id: string;
  number: number;
  name: string;
  description: string | null;
  isActive: boolean;
  materials: MaterialBox[];
};

type Fila = { key: number; material: string; perBox: string };

/** Alta y edición de una caja del recorrido: N°, nombre, descripción y materiales por caja. */
export function CajaForm({ caja, numeroSugerido }: { caja?: CajaInicial; numeroSugerido?: number }) {
  const [state, action, pending] = useActionState(guardarCajaAction, initial);
  const [filas, setFilas] = useState<Fila[]>(() => {
    const iniciales = caja?.materials.length
      ? caja.materials.map((m, i) => ({ key: i, material: m.material, perBox: String(m.perBox) }))
      : [{ key: 0, material: "", perBox: "1" }];
    return iniciales;
  });

  const agregar = () =>
    setFilas((f) => [...f, { key: (f.at(-1)?.key ?? 0) + 1, material: "", perBox: "1" }]);
  const quitar = (key: number) => setFilas((f) => (f.length > 1 ? f.filter((x) => x.key !== key) : f));
  const cambiar = (key: number, campo: "material" | "perBox", valor: string) =>
    setFilas((f) => f.map((x) => (x.key === key ? { ...x, [campo]: valor } : x)));

  return (
    <form action={action} className="fo-section-gap max-w-3xl">
      {caja ? <input type="hidden" name="id" value={caja.id} /> : null}

      <section className="fo-card space-y-6">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="number">
              BOX N°
            </label>
            <input
              id="number"
              name="number"
              type="number"
              min={1}
              max={1000}
              required
              defaultValue={caja?.number ?? numeroSugerido ?? 1}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={160}
              defaultValue={caja?.name}
              className="fo-input"
              placeholder="Ej. Soltar la mano"
            />
          </div>
        </div>
        <p className="fo-helper">
          El N° define el orden: cada persona recibe las cajas de menor a mayor, empezando por la N°1.
        </p>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={caja?.description ?? ""}
            className="fo-input"
            placeholder="Opcional — de qué se trata esta caja."
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={caja?.isActive ?? true}
            className="mt-1 size-4 rounded border-[var(--fo-border)]"
          />
          <span>
            <span className="fo-label !inline">Activa</span>
            <span className="fo-helper block mt-1">
              Una caja desactivada deja de ofrecerse: quien no la recibió pasa directo a la siguiente.
              Quien ya la recibió la conserva en su historial.
            </span>
          </span>
        </label>
      </section>

      <section className="fo-card space-y-4">
        <div>
          <h2 className="text-base font-semibold">Materiales</h2>
          <p className="fo-helper mt-1">Lo que lleva cada caja y cuántas unidades por caja.</p>
        </div>
        <ul className="space-y-2">
          {filas.map((f, i) => (
            <li key={f.key} className="flex items-center gap-2">
              <input
                name="material"
                value={f.material}
                onChange={(e) => cambiar(f.key, "material", e.target.value)}
                aria-label={`Material ${i + 1}`}
                placeholder="Ej. Lápiz grafito HB"
                maxLength={200}
                className="fo-input flex-1"
              />
              <input
                name="perBox"
                type="number"
                min={1}
                max={1000}
                value={f.perBox}
                onChange={(e) => cambiar(f.key, "perBox", e.target.value)}
                aria-label={`Cantidad por caja de material ${i + 1}`}
                className="fo-input w-24"
              />
              <button
                type="button"
                onClick={() => quitar(f.key)}
                disabled={filas.length === 1}
                className="fo-btn fo-btn-ghost text-xs disabled:opacity-40"
                aria-label={`Quitar material ${i + 1}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={agregar} className="fo-btn fo-btn-secondary text-sm">
          Agregar material
        </button>
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : caja ? "Guardar cambios" : "Crear caja"}
        </button>
      </div>
    </form>
  );
}
