"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth } from "@/components/admin/AdminForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  addTicketProductFormAction,
  updateTicketProductFormAction,
} from "@/lib/admin-catalog/actions/ticket-forms";
import { removeTicketProductAction } from "@/lib/admin-catalog/actions/tickets";
import type { CatalogActionState } from "@/lib/admin-catalog/actions/action-result";
import type { ProductListItem, TicketTypeItemRecord } from "@/lib/admin-catalog/domain/types";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { LOW_STOCK_THRESHOLD, displayPrice } from "@/lib/admin-catalog/ui/money-ui";

type Props = {
  ticketTypeId: string;
  items: TicketTypeItemRecord[];
  products: ProductListItem[];
};

export function TicketCompositionPanel({ ticketTypeId, items, products }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const productsById = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p]));
    return m;
  }, [products]);

  const availableProducts = products.filter(
    (p) => !items.some((i) => i.productId === p.id),
  );

  return (
    <section className="space-y-6" aria-labelledby="composition-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="composition-heading" className="text-xl font-semibold text-ck-text">
            Productos incluidos
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ck-text-secondary">
            Definición comercial del kit. No reserva ni mueve stock. Podés dejar la entrada sin
            productos (entrada simple).
          </p>
        </div>
        {!showAdd ? (
          <Button type="button" variant="primary" onClick={() => setShowAdd(true)}>
            Agregar producto
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {showAdd ? (
        <AddItemForm
          ticketTypeId={ticketTypeId}
          products={availableProducts}
          onCancel={() => setShowAdd(false)}
        />
      ) : null}

      {items.length === 0 && !showAdd ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-10 text-center">
          <p className="text-lg text-ck-text">Entrada sin productos</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Es válida como entrada simple. Agregá productos para armar un pack o kit.
          </p>
          {products.length === 0 ? (
            <p className="mt-4 text-sm text-ck-text-muted">
              No hay productos en esta edición.{" "}
              <a className="text-ck-yellow underline" href={catalogAdminRoutes.products}>
                Ir a productos
              </a>
            </p>
          ) : (
            <div className="mt-6">
              <Button type="button" variant="primary" onClick={() => setShowAdd(true)}>
                Agregar producto
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border">
          <table className="min-w-[880px] w-full text-left text-sm">
            <thead className="border-b border-ck-border bg-ck-bg/50 text-ck-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Talle u opción</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const product = productsById.get(item.productId);
                const variant = item.productVariantId
                  ? product?.variants.find((v) => v.id === item.productVariantId)
                  : null;
                const stockTotal = variant
                  ? variant.stock
                  : product
                    ? product.variants.reduce((s, v) => s + v.stock, 0)
                    : null;
                const reserved = variant
                  ? variant.reservedStock
                  : product
                    ? product.variants.reduce((s, v) => s + v.reservedStock, 0)
                    : null;
                const available =
                  stockTotal != null && reserved != null
                    ? Math.max(0, stockTotal - reserved)
                    : null;

                if (editingProductId === item.productId) {
                  return (
                    <tr key={item.id} className="border-b border-ck-border/70">
                      <td colSpan={6} className="px-4 py-4">
                        <EditItemForm
                          ticketTypeId={ticketTypeId}
                          item={item}
                          product={product}
                          onCancel={() => setEditingProductId(null)}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id} className="border-b border-ck-border/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ck-text">
                        {product?.name ?? item.productId}
                      </div>
                      {!product ? (
                        <p className="text-xs text-[var(--ck-danger)]">Producto inexistente</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {item.requiresVariantChoice ? (
                        <span className="text-ck-text-secondary">Selección en inscripción</span>
                      ) : variant ? (
                        <div>
                          <div>{variant.name}</div>
                          <div className="text-xs text-ck-text-muted">
                            {displayPrice(variant.priceAmount, variant.currency)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-ck-text-secondary">Producto (sin variante fija)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {available == null ? (
                        "—"
                      ) : (
                        <span title="total / reservado / disponible">
                          {stockTotal} / {reserved} / {available}
                          {available <= 0 ? (
                            <Badge variant="danger" className="ml-2">
                              Sin stock
                            </Badge>
                          ) : available <= LOW_STOCK_THRESHOLD ? (
                            <Badge variant="warning" className="ml-2">
                              Poco stock
                            </Badge>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={product?.isActive ? "success" : "neutral"}>
                          Prod. {product?.isActive ? "activo" : "inactivo"}
                        </Badge>
                        {variant ? (
                          <Badge variant={variant.isActive ? "success" : "neutral"}>
                            Var. {variant.isActive ? "activa" : "inactiva"}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingProductId(item.productId)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "¿Quitar este producto de la composición? No elimina el producto del catálogo ni mueve stock.",
                              )
                            ) {
                              return;
                            }
                            startTransition(async () => {
                              const result = await removeTicketProductAction(
                                ticketTypeId,
                                item.productId,
                              );
                              if (!result.ok) {
                                setError(result.message ?? "No se pudo quitar.");
                                return;
                              }
                              router.push(
                                `${catalogAdminRoutes.ticketDetail(ticketTypeId)}?flash=ticket_item_removed`,
                              );
                              router.refresh();
                            });
                          }}
                        >
                          Quitar
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

function AddItemForm({
  ticketTypeId,
  products,
  onCancel,
}: {
  ticketTypeId: string;
  products: ProductListItem[];
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    addTicketProductFormAction.bind(null, ticketTypeId),
    undefined,
  );
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [mode, setMode] = useState<"fixed" | "choice">("fixed");
  const [variantId, setVariantId] = useState("");

  useEffect(() => {
    if (!product) return;
    if (product.variants.length === 0) {
      setMode("fixed");
      setVariantId("");
    } else if (mode === "fixed" && !variantId) {
      setVariantId(product.variants[0]?.id ?? "");
    }
  }, [product, mode, variantId]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-ck-text-secondary" role="status">
        No hay productos elegibles (todos ya están incluidos o la edición no tiene productos).
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state?.message && !state.ok ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}
      <AdminForm
        title="Agregar producto al kit"
        description="Si el producto tiene variantes, elegí una fija o permití selección en inscripción."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={pending}>
              Agregar
            </Button>
          </>
        }
      >
        <AdminFormFullWidth>
          <Field id="productId" label="Producto" required error={state?.errors?.productId}>
            <select
              id="productId"
              name="productId"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId("");
              }}
              className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}){p.isActive ? "" : " — inactivo"}
                </option>
              ))}
            </select>
          </Field>
        </AdminFormFullWidth>

        {product && product.variants.length > 0 ? (
          <AdminFormFullWidth>
            <fieldset className="space-y-2">
              <legend className="ck-label text-ck-text">Variante</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "fixed"}
                  onChange={() => setMode("fixed")}
                />
                Variante fija
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="requiresVariantChoice"
                  value="on"
                  checked={mode === "choice"}
                  onChange={() => setMode("choice")}
                />
                El participante elige variante
              </label>
            </fieldset>
            {mode === "fixed" ? (
              <Field id="productVariantId" label="Variante" className="mt-3">
                <select
                  id="productVariantId"
                  name="productVariantId"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
                >
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.sku}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <input type="hidden" name="productVariantId" value="" />
            )}
          </AdminFormFullWidth>
        ) : (
          <input type="hidden" name="productVariantId" value="" />
        )}

        <Field id="quantity" label="Cantidad" required error={state?.errors?.quantity}>
          <Input name="quantity" inputMode="numeric" defaultValue="1" />
        </Field>
      </AdminForm>
    </form>
  );
}

function EditItemForm({
  ticketTypeId,
  item,
  product,
  onCancel,
}: {
  ticketTypeId: string;
  item: TicketTypeItemRecord;
  product?: ProductListItem;
  onCancel: () => void;
}) {
  const bound = updateTicketProductFormAction.bind(null, ticketTypeId, item.productId);
  const [state, formAction, pending] = useActionState(
    bound as (
      prev: CatalogActionState | undefined,
      formData: FormData,
    ) => Promise<CatalogActionState>,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state?.message && !state.ok ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Field id={`qty-${item.id}`} label="Cantidad" required>
          <Input name="quantity" inputMode="numeric" defaultValue={String(item.quantity)} />
        </Field>
        {product && product.variants.length > 0 ? (
          <>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="requiresVariantChoice"
                defaultChecked={item.requiresVariantChoice}
              />
              Selección de variante
            </label>
            <Field id={`var-${item.id}`} label="Variante fija">
              <select
                id={`var-${item.id}`}
                name="productVariantId"
                defaultValue={item.productVariantId ?? ""}
                className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
              >
                <option value="">—</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
