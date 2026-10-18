"use client";

import { useState, useTransition } from "react";
import { InputMoneda } from "@/components/campos/input-moneda";
import { Dialogo } from "./dialogo";
import { registrarEgresoAction } from "./mostrador-actions";

export type DatosEgreso = {
  cuentas: { id: string; nombre: string; efectivo: boolean; predeterminada: boolean }[];
  categorias: { id: string; nombre: string }[];
};

/**
 * Anotar lo que sale de la caja sin dejar el mostrador: insumos, un pago, un retiro. Por omisión
 * sale del efectivo del mostrador (la cuenta que lleva turno), que es lo que se toca a mano.
 */
export function EgresoDialogo({
  datos,
  onCerrar,
  onListo,
}: {
  datos: DatosEgreso;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const cuentaInicial =
    datos.cuentas.find((c) => c.efectivo)?.id ?? datos.cuentas.find((c) => c.predeterminada)?.id ?? datos.cuentas[0]?.id ?? "";
  const [error, setError] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  if (datos.cuentas.length === 0) {
    return (
      <Dialogo titulo="Registrar egreso" onCerrar={onCerrar}>
        <p className="text-sm text-[var(--fo-muted)]">
          Todavía no hay cuentas de caja. Se crean en Caja → Cuentas y categorías.
        </p>
      </Dialogo>
    );
  }

  return (
    <Dialogo titulo="Registrar egreso" onCerrar={onCerrar}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startGuardar(async () => {
            const r = await registrarEgresoAction(fd);
            if (r.ok) onListo(r.mensaje);
            else setError(r.error);
          });
        }}
      >
        <label className="fo-field-stack text-sm">
          <span className="fo-label">Importe</span>
          <InputMoneda name="amountArs" placeholder="5.000" required className="fo-input text-base" />
        </label>
        <label className="fo-field-stack text-sm">
          <span className="fo-label">Qué se pagó y a quién</span>
          <input name="description" required className="fo-input" placeholder="Ej.: resmas — Papelería Norte" autoComplete="off" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Sale de</span>
            <select name="accountId" defaultValue={cuentaInicial} className="fo-input">
              {datos.cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Categoría</span>
            <select name="categoryId" defaultValue="" className="fo-input">
              <option value="">Sin categoría</option>
              {datos.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Medio</span>
            <select name="paymentMethod" defaultValue="EFECTIVO" className="fo-input">
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="MERCADO_PAGO">Mercado Pago</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Comprobante</span>
            <input name="receiptRef" className="fo-input" placeholder="Opcional" autoComplete="off" />
          </label>
        </div>
        {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className="fo-btn fo-btn-secondary text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="fo-btn fo-btn-primary text-sm">
            {guardando ? "Guardando…" : "Anotar egreso"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
