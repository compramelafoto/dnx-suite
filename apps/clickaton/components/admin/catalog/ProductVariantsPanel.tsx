"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { VariantForm } from "./VariantForm";
import { StockAdjustForm } from "./StockAdjustForm";
import {
  createVariantFormAction,
  updateVariantFormAction,
  adjustStockFormAction,
} from "@/lib/admin-catalog/actions/product-forms";
import { setVariantActiveAction } from "@/lib/admin-catalog/actions/products";
import { displayPrice, stockTone } from "@/lib/admin-catalog/ui/money-ui";
import type { ProductVariantRecord } from "@/lib/admin-catalog/domain/types";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";

type Props = {
  productId: string;
  variants: ProductVariantRecord[];
};

type PanelMode =
  | { kind: "idle" }
  | { kind: "create" }
  | { kind: "edit"; variant: ProductVariantRecord }
  | { kind: "stock"; variant: ProductVariantRecord };

function StockBadge({ available, isActive }: { available: number; isActive: boolean }) {
  const tone = stockTone(available, isActive);
  if (tone === "inactive") return <Badge variant="neutral">Inactiva</Badge>;
  if (tone === "sold_out") return <Badge variant="danger">Agotado</Badge>;
  if (tone === "low") return <Badge variant="warning">Poco stock</Badge>;
  return <Badge variant="success">Disponible</Badge>;
}

export function ProductVariantsPanel({ productId, variants }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="space-y-6" aria-labelledby="variants-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="variants-heading" className="text-xl font-semibold text-ck-text">
            Talles y opciones
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ck-text-secondary">
            Stock, precio opcional y estado por talle u opción. Umbral «poco stock»: disponible ≤ 5.
          </p>
        </div>
        {mode.kind === "idle" ? (
          <Button type="button" variant="primary" onClick={() => setMode({ kind: "create" })}>
            Agregar talle u opción
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {mode.kind === "create" ? (
        <VariantForm
          mode="create"
          action={createVariantFormAction.bind(null, productId)}
          onCancel={() => setMode({ kind: "idle" })}
        />
      ) : null}

      {mode.kind === "edit" ? (
        <VariantForm
          mode="edit"
          initialValues={mode.variant}
          action={updateVariantFormAction.bind(null, mode.variant.id, productId)}
          onCancel={() => setMode({ kind: "idle" })}
        />
      ) : null}

      {mode.kind === "stock" ? (
        <StockAdjustForm
          stock={mode.variant.stock}
          reservedStock={mode.variant.reservedStock}
          availableStock={Math.max(0, mode.variant.stock - mode.variant.reservedStock)}
          variantName={mode.variant.name}
          action={adjustStockFormAction.bind(null, mode.variant.id, productId)}
          onCancel={() => setMode({ kind: "idle" })}
        />
      ) : null}

      {variants.length === 0 && mode.kind === "idle" ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-10 text-center">
          <p className="text-lg text-ck-text">Todavía no hay talles u opciones</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Agregá al menos un talle u opción para gestionar disponibilidad. Después podés incluir
            el producto en una fase o entrada.
          </p>
          <div className="mt-6">
            <Button type="button" variant="primary" onClick={() => setMode({ kind: "create" })}>
              Agregar talle u opción
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-ck-border bg-ck-bg/50 text-ck-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Código interno</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Reservado</th>
                <th className="px-4 py-3 font-medium">Disponible</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const available = Math.max(0, v.stock - v.reservedStock);
                return (
                  <tr key={v.id} className="border-b border-ck-border/70">
                    <td className="px-4 py-3 text-ck-text">{v.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{v.code}</td>
                    <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                    <td className="px-4 py-3">{displayPrice(v.priceAmount, v.currency)}</td>
                    <td className="px-4 py-3">{v.stock}</td>
                    <td className="px-4 py-3">{v.reservedStock}</td>
                    <td className="px-4 py-3 font-semibold">{available}</td>
                    <td className="px-4 py-3">
                      <StockBadge available={available} isActive={v.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setMode({ kind: "edit", variant: v })}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setMode({ kind: "stock", variant: v })}
                        >
                          Ajustar stock
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            const next = !v.isActive;
                            const ok = window.confirm(
                              next
                                ? "¿Reactivar esta variante?"
                                : [
                                    "¿Desactivar esta variante?",
                                    "",
                                    "• No elimina el registro",
                                    "• No modifica inscripciones históricas",
                                    "• Evita selección futura",
                                  ].join("\n"),
                            );
                            if (!ok) return;
                            startTransition(async () => {
                              const result = await setVariantActiveAction(v.id, productId, next);
                              if (!result.ok) {
                                setError(result.message ?? "No se pudo cambiar el estado.");
                                return;
                              }
                              router.push(
                                `${catalogAdminRoutes.productDetail(productId)}?flash=${
                                  next ? "variant_activated" : "variant_deactivated"
                                }`,
                              );
                              router.refresh();
                            });
                          }}
                        >
                          {v.isActive ? "Desactivar variante" : "Reactivar variante"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
