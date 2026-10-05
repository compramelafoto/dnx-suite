"use client";

import { useState, useTransition } from "react";
import {
  deletePrintFormatAction,
  movePrintFormatAction,
  savePrintFormatAction,
  setPrintFormatActiveAction,
  type FormatsActionResult,
} from "./actions";
import { FormatsResult } from "./formats-result";

export type PrintFormatView = {
  id: string;
  name: string;
  kind: "PRINT" | "FRAME";
  widthCm: number;
  heightCm: number;
  price: string;
  cost: string;
  weightGrams: number | null;
  packLengthCm: number | null;
  packWidthCm: number | null;
  packHeightCm: number | null;
  isActive: boolean;
  priceText: string;
  costText: string | null;
  requiredPx: number;
};

function FormatForm({ formato, onDone }: { formato: PrintFormatView | null; onDone: () => void }) {
  const [resultado, setResultado] = useState<FormatsActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  const f = formato;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setResultado(null);
        startTransition(async () => {
          const r = await savePrintFormatAction(fd);
          setResultado(r);
          if (r.ok) {
            if (!f) form.reset();
            onDone();
          }
        });
      }}
      className="space-y-3"
    >
      {f ? <input type="hidden" name="id" value={f.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label">Nombre</label>
          <input name="name" className="fo-input" defaultValue={f?.name ?? ""} placeholder="Copia 20x30" required maxLength={80} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label">Tipo</label>
          <select name="kind" className="fo-input" defaultValue={f?.kind ?? "PRINT"}>
            <option value="PRINT">Impresión</option>
            <option value="FRAME">Cuadro</option>
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label">Ancho (cm)</label>
          <input name="widthCm" type="number" min={5} max={200} step={1} className="fo-input" defaultValue={f?.widthCm ?? ""} required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label">Alto (cm)</label>
          <input name="heightCm" type="number" min={5} max={200} step={1} className="fo-input" defaultValue={f?.heightCm ?? ""} required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label">Precio de venta ($)</label>
          <input name="price" inputMode="decimal" className="fo-input" defaultValue={f?.price ?? ""} placeholder="12500" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label">Costo ($, opcional)</label>
          <input name="cost" inputMode="decimal" className="fo-input" defaultValue={f?.cost ?? ""} placeholder="4000" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label">Peso (gramos, opcional)</label>
          <input name="weightGrams" type="number" min={1} max={30000} step={1} className="fo-input" defaultValue={f?.weightGrams ?? ""} />
          <p className="fo-helper">Si lo dejás vacío, el envío usa el peso por defecto de la configuración de envíos.</p>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="fo-label">Embalaje en cm (opcional; las tres medidas juntas)</legend>
        <div className="grid max-w-md gap-3 sm:grid-cols-3">
          <input name="packLengthCm" type="number" min={1} max={150} step={1} className="fo-input" defaultValue={f?.packLengthCm ?? ""} placeholder="Largo" aria-label="Largo del embalaje" />
          <input name="packWidthCm" type="number" min={1} max={150} step={1} className="fo-input" defaultValue={f?.packWidthCm ?? ""} placeholder="Ancho" aria-label="Ancho del embalaje" />
          <input name="packHeightCm" type="number" min={1} max={150} step={1} className="fo-input" defaultValue={f?.packHeightCm ?? ""} placeholder="Alto" aria-label="Alto del embalaje" />
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : f ? "Guardar cambios" : "Crear formato"}
        </button>
        {f ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onDone}>
            Cancelar
          </button>
        ) : null}
      </div>
      <FormatsResult resultado={resultado} />
    </form>
  );
}

export function FormatEditor({ formats, minDpi }: { formats: PrintFormatView[]; minDpi: number }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<FormatsActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(accion: () => Promise<FormatsActionResult>) {
    setResultado(null);
    startTransition(async () => setResultado(await accion()));
  }

  return (
    <div className="space-y-6">
      {formats.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no cargaste ningún formato.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {formats.map((f, i) => (
            <li key={f.id} className="space-y-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {f.name} {f.isActive ? null : <span className="text-[var(--fo-muted)]">(desactivado)</span>}
                  </p>
                  <p className="text-[var(--fo-muted)]">
                    {f.kind === "FRAME" ? "Cuadro" : "Impresión"} · {f.widthCm} × {f.heightCm} cm · Precio {f.priceText}
                    {f.costText ? ` · Costo ${f.costText}` : ""} ·{" "}
                    {f.weightGrams ? `${f.weightGrams} g` : "sin peso (usa el de envíos)"}
                  </p>
                  <p className="text-[var(--fo-muted)]">
                    Requiere {f.requiredPx.toLocaleString("es-AR")} px de lado mayor a {minDpi} dpi
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || i === 0} onClick={() => correr(() => movePrintFormatAction(f.id, "up"))} aria-label="Subir">
                    ↑
                  </button>
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || i === formats.length - 1} onClick={() => correr(() => movePrintFormatAction(f.id, "down"))} aria-label="Bajar">
                    ↓
                  </button>
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setEditando(editando === f.id ? null : f.id)}>
                    Editar
                  </button>
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => correr(() => setPrintFormatActiveAction(f.id, !f.isActive))}>
                    {f.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className="fo-btn fo-btn-secondary text-sm"
                    disabled={pendiente}
                    onClick={() => {
                      if (!window.confirm(`¿Borrar "${f.name}"? Si ya se usó en pedidos, se deja desactivado en lugar de borrarlo.`)) return;
                      correr(() => deletePrintFormatAction(f.id));
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
              {editando === f.id ? <FormatForm formato={f} onDone={() => setEditando(null)} /> : null}
            </li>
          ))}
        </ul>
      )}
      <FormatsResult resultado={resultado} />
      <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
        <h3 className="text-sm font-semibold">Agregar un formato</h3>
        <FormatForm formato={null} onDone={() => undefined} />
      </div>
    </div>
  );
}
