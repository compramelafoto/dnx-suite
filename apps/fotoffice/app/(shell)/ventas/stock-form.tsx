"use client";

import { useState } from "react";
import type { ProductRow } from "@/lib/sales/repository";
import { recordAdjustmentAction, recordStockEntryAction } from "./actions";

type Modo = "cerrado" | "entrada" | "ajuste";

/**
 * Una fila de stock: la existencia, el mínimo, y las dos únicas acciones que se hacen desde
 * acá —cargar una entrada o ajustar por conteo—.
 *
 * Corre en el navegador sólo para abrir y cerrar el mini-formulario de cada acción, así la
 * fila no queda con dos formularios abiertos todo el tiempo cuando nadie los está usando. La
 * validación de verdad —cantidad mayor que cero, nota obligatoria en el ajuste— no se movió
 * de `lib/sales/stock.ts`; esto sólo junta lo que ya tipeó la persona en un `FormData` y lo
 * manda al servidor.
 */
export function StockForm({ product, destacado }: { product: ProductRow; destacado: boolean }) {
  const [modo, setModo] = useState<Modo>("cerrado");

  return (
    <div
      className={`fo-card space-y-3 p-4 ${destacado ? "border-2 border-[var(--fo-danger)]" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[var(--fo-text)]">{product.name}</p>
          {product.categoryName ? (
            <p className="text-xs text-[var(--fo-muted)]">{product.categoryName}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className={destacado ? "font-semibold text-[var(--fo-danger)]" : "text-[var(--fo-text)]"}>
            Existencia: {product.stockQty}
          </span>
          <span className="text-[var(--fo-muted)]">Mínimo: {product.minStockQty ?? "—"}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="fo-btn fo-btn-secondary text-sm"
            onClick={() => setModo((m) => (m === "entrada" ? "cerrado" : "entrada"))}
          >
            Cargar entrada
          </button>
          <button
            type="button"
            className="fo-btn fo-btn-ghost text-sm"
            onClick={() => setModo((m) => (m === "ajuste" ? "cerrado" : "ajuste"))}
          >
            Ajustar por conteo
          </button>
        </div>
      </div>

      {modo === "entrada" ? (
        <form
          action={recordStockEntryAction}
          className="grid gap-3 border-t border-[var(--fo-border)] pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="productId" value={product.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`entrada-qty-${product.id}`}>
              Cantidad que entró
            </label>
            <input
              id={`entrada-qty-${product.id}`}
              name="qty"
              type="number"
              min={1}
              step={1}
              required
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`entrada-costo-${product.id}`}>
              Costo unitario (opcional)
            </label>
            <input
              id={`entrada-costo-${product.id}`}
              name="unitCostArs"
              className="fo-input"
              placeholder="$"
            />
          </div>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Confirmar entrada
          </button>
        </form>
      ) : null}

      {modo === "ajuste" ? (
        <form
          action={recordAdjustmentAction}
          className="grid gap-3 border-t border-[var(--fo-border)] pt-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
        >
          <input type="hidden" name="productId" value={product.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`ajuste-qty-${product.id}`}>
              Contaste
            </label>
            <input
              id={`ajuste-qty-${product.id}`}
              name="countedQty"
              type="number"
              min={0}
              step={1}
              required
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`ajuste-nota-${product.id}`}>
              Por qué ajustás
            </label>
            <input
              id={`ajuste-nota-${product.id}`}
              name="note"
              className="fo-input"
              placeholder="Conteo de fin de mes"
              required
            />
          </div>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Confirmar ajuste
          </button>
        </form>
      ) : null}
    </div>
  );
}
