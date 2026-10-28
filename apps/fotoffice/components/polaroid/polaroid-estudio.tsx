"use client";

import { useState } from "react";
import Link from "next/link";
import PolaroidEditor from "./PolaroidEditor";
import { POLAROID_PRESETS } from "./presets";
import type { PolaroidItem } from "./export";
import { cobroDePolaroids, ENTREGAS_POLAROID, type EntregaPolaroid, type RenglonPolaroid } from "@/lib/polaroid/productos";
import { enlaceAgregarAlAbrir } from "@/lib/sales/agregar-al-abrir";
import { formatMinorArs } from "@/lib/membership/money";

type ProductoPolaroid = { sku: string; nombre: string; precioMinor: number };

/**
 * El diseñador de polaroids en FOTOFFICE: lo de CompraMeLaFoto, más la entrega y lo que hay que
 * cobrar. Al bajar las planchas muestra un renglón por medida con su producto del catálogo y,
 * si la persona puede cobrar, el botón que lo lleva al Mostrador.
 */
export function PolaroidEstudio({ productos, puedeCobrar }: { productos: ProductoPolaroid[]; puedeCobrar: boolean }) {
  const [entrega, setEntrega] = useState<EntregaPolaroid>("INS");
  const [cobro, setCobro] = useState<RenglonPolaroid[] | null>(null);
  const porSku = new Map(productos.map((p) => [p.sku, p]));
  const etiquetaMedida = new Map<string, string>(POLAROID_PRESETS.map((p) => [p.id, p.label]));

  const alExportar = async ({ blob, filename, items }: { blob: Blob; filename: string; items: PolaroidItem[] }) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setCobro(cobroDePolaroids(items, entrega));
  };

  const conPrecio = (cobro ?? []).filter((r) => porSku.has(r.sku));
  const sinPrecio = (cobro ?? []).filter((r) => !porSku.has(r.sku));
  const total = conPrecio.reduce((s, r) => s + r.cantidad * porSku.get(r.sku)!.precioMinor, 0);

  return (
    <div className="space-y-4">
      <fieldset className="fo-card flex flex-wrap items-center gap-4 p-4">
        <legend className="sr-only">Entrega</legend>
        <span className="text-sm font-medium">Entrega</span>
        {ENTREGAS_POLAROID.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="entrega"
              value={e.id}
              checked={entrega === e.id}
              onChange={() => {
                setEntrega(e.id);
                setCobro(null);
              }}
            />
            {e.label}
          </label>
        ))}
        <span className="text-xs text-[var(--fo-muted)]">
          Cada polaroid se cobra como una copia de la hoja en que se imprime: 7,5×10 y 10×15 como 10×15; 9×13 como 13×18.
        </span>
      </fieldset>

      <PolaroidEditor onExport={alExportar} submitLabel="Bajar las planchas" />

      {cobro ? (
        <section className="fo-card space-y-3 p-4" aria-live="polite">
          <h2 className="text-sm font-semibold">Para cobrar</h2>
          {conPrecio.length > 0 ? (
            <table className="w-full text-left text-sm">
              <tbody>
                {conPrecio.map((r) => {
                  const p = porSku.get(r.sku)!;
                  return (
                    <tr key={r.sku} className="border-b border-[var(--fo-border)] last:border-0">
                      <td className="py-2 pr-3">{p.nombre}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {r.cantidad} × {formatMinorArs(p.precioMinor)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatMinorArs(r.cantidad * p.precioMinor)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="pt-2 font-semibold" colSpan={2}>
                    Total
                  </td>
                  <td className="pt-2 text-right font-semibold tabular-nums">{formatMinorArs(total)}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
          {sinPrecio.length > 0 ? (
            <p className="text-sm text-[var(--fo-danger,#b91c1c)]">
              Falta en el catálogo el producto de {sinPrecio.map((r) => `${etiquetaMedida.get(r.presetId) ?? r.presetId} (${r.sku})`).join(", ")}. Cargalo en Ventas → Catálogo con ese código.
            </p>
          ) : null}
          {puedeCobrar && conPrecio.length > 0 ? (
            <Link className="fo-btn fo-btn-primary text-sm" href={enlaceAgregarAlAbrir(conPrecio.map((r) => ({ sku: r.sku, cantidad: r.cantidad })))}>
              Cobrar en el Mostrador
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
