"use client";

import { useActionState, useMemo, useState } from "react";
import { crearFotolibroAction, type NuevoFotolibroState } from "@/app/actions/fotolibro";
import {
  LINEAS_FOTOLIBRO,
  MEDIDAS_PLIEGO,
  describirCerrado,
  describirPliego,
  medidasDelProveedor,
  type LineaFotolibro,
} from "@/lib/fotolibro/medidas-pliego";
import { HOJAS_MAX, HOJAS_MIN } from "@/lib/fotolibro/limites";

type Proveedor = { id: string; name: string };

const initial: NuevoFotolibroState = { error: null };

/**
 * Arranca un fotolibro con la medida real del pliego. Elegido el laboratorio, sólo se ofrecen
 * las medidas de su lista.
 */
export function NuevoFotolibro({
  proveedores,
  accion = crearFotolibroAction,
}: {
  proveedores: Proveedor[];
  /** Quién crea el fotolibro: el estudio (por defecto) o el socio desde su portal. */
  accion?: (prev: NuevoFotolibroState, formData: FormData) => Promise<NuevoFotolibroState>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [state, action, pending] = useActionState(accion, initial);

  const medidas = useMemo(() => {
    const p = proveedores.find((x) => x.id === proveedorId);
    return (p ? medidasDelProveedor(p.name) : null) ?? [...MEDIDAS_PLIEGO];
  }, [proveedorId, proveedores]);

  const lineas = (Object.keys(LINEAS_FOTOLIBRO) as LineaFotolibro[]).filter((l) =>
    medidas.some((m) => m.linea === l),
  );

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="fo-btn fo-btn-secondary text-sm">
        Nuevo fotolibro
      </button>
    );
  }

  return (
    <form action={action} className="fo-card grid w-full gap-3 p-5 sm:max-w-xl sm:grid-cols-2">
      <h2 className="text-base font-semibold sm:col-span-2">Nuevo fotolibro</h2>

      <label className="space-y-1 text-sm">
        <span className="text-[var(--fo-muted)]">Laboratorio</span>
        <select
          name="proveedorId"
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
          className="fo-input w-full"
        >
          <option value="">Sin elegir (todas las medidas)</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm">
        <span className="text-[var(--fo-muted)]">Medida del pliego</span>
        <select name="medidaId" required className="fo-input w-full" key={proveedorId}>
          {lineas.map((l) => (
            <optgroup key={l} label={LINEAS_FOTOLIBRO[l]}>
              {medidas
                .filter((m) => m.linea === l)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} — {describirPliego(m)} (libro de {describirCerrado(m)})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm">
        <span className="text-[var(--fo-muted)]">Hojas (1 hoja = 2 páginas)</span>
        <input
          name="hojas"
          type="number"
          min={HOJAS_MIN}
          max={HOJAS_MAX}
          defaultValue={10}
          required
          className="fo-input w-full"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="text-[var(--fo-muted)]">Nombre</span>
        <input name="nombre" placeholder="Ej.: Boda Ana y Luis" className="fo-input w-full" />
      </label>

      {state.error ? <p className="text-sm text-[var(--fo-danger)] sm:col-span-2">{state.error}</p> : null}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm">
          {pending ? "Creando…" : "Crear y abrir el editor"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="fo-btn fo-btn-secondary text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
