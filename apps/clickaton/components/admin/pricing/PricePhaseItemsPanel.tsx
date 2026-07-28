"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth, AdminFormSection } from "@/components/admin/AdminForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { ProductListItem } from "@/lib/admin-catalog/domain/types";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin-catalog/ui/money-ui";
import {
  addPricePhaseItemAction,
  duplicatePhaseItemsFromPhaseAction,
  removePricePhaseItemAction,
  updatePricePhaseItemAction,
  type PricePhaseItemActionState,
  type PricePhaseItemRecord,
} from "@/lib/admin/pricing/phase-items";
import type { PricePhaseRecord } from "@/lib/pricing/domain/types";

type Props = {
  editionId: string;
  phase: PricePhaseRecord;
  items: PricePhaseItemRecord[];
  products: ProductListItem[];
  otherPhases: PricePhaseRecord[];
  registrationCount: number;
};

function buildInclusionPreview(items: PricePhaseItemRecord[]): string {
  if (items.length === 0) return "Tu inscripción incluye la entrada (sin productos extra de fase).";
  const labels = items.map((item) => {
    const name = item.displayTitle?.trim() || item.product.name;
    return item.quantity > 1 ? `${item.quantity}× ${name}` : name;
  });
  return `Así se verá: Tu inscripción incluye ${labels.join(", ")}.`;
}

function productAvailableStock(product: PricePhaseItemRecord["product"]): number {
  return product.variants.reduce(
    (sum, v) => sum + Math.max(0, v.stock - v.reservedStock),
    0,
  );
}

export function PricePhaseItemsPanel({
  editionId,
  phase,
  items,
  products,
  otherPhases,
  registrationCount,
}: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [duplicateSourceId, setDuplicateSourceId] = useState(otherPhases[0]?.id ?? "");
  const [pendingDup, startDup] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const usedProductIds = new Set(items.map((i) => i.productId));
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id));

  const alerts = useMemo(() => {
    const list: Array<{ tone: "warning" | "danger"; text: string }> = [];
    if (items.length === 0) {
      list.push({
        tone: "warning",
        text: "Esta fase no incluye productos. Solo aplica el precio de la fase.",
      });
    }
    for (const item of items) {
      const activeVariants = item.product.variants.filter((v) => v.isActive);
      if (item.requiresVariantChoice && activeVariants.length === 0) {
        list.push({
          tone: "danger",
          text: `«${item.product.name}» exige talle pero no tiene variantes activas.`,
        });
      }
      const available = productAvailableStock(item.product);
      if (available <= 0) {
        list.push({
          tone: "danger",
          text: `«${item.product.name}» sin stock disponible.`,
        });
      } else if (available <= LOW_STOCK_THRESHOLD) {
        list.push({
          tone: "warning",
          text: `«${item.product.name}» con poco stock (${available} disp.).`,
        });
      }
    }
    return list;
  }, [items]);

  const preview = buildInclusionPreview(items);

  return (
    <section className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ck-text">Productos incluidos en la fase</h3>
          <p className="mt-1 max-w-2xl text-sm text-ck-text-secondary">
            Beneficios comerciales exclusivos de «{phase.name}». No dupliques productos que ya estén
            en entradas (ticket base).
          </p>
        </div>
        {!showAdd ? (
          <Button type="button" variant="secondary" onClick={() => setShowAdd(true)}>
            Agregar producto
          </Button>
        ) : null}
      </div>

      {registrationCount > 0 ? (
        <p className="rounded-[var(--ck-radius-card)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-ck-text">
          Hay {registrationCount} inscripción(es) con esta fase. Cambios no alteran snapshots ya
          guardados.
        </p>
      ) : null}

      {alerts.map((a) => (
        <p
          key={a.text}
          className={`rounded-[var(--ck-radius-card)] border px-4 py-3 text-sm ${
            a.tone === "danger"
              ? "border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)]"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
          role="alert"
        >
          {a.text}
        </p>
      ))}

      <p className="text-sm text-ck-text-muted italic">{preview}</p>

      {error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-ck-text" role="status">
          {notice}
        </p>
      ) : null}

      {showAdd ? (
        <AddPhaseItemForm
          editionId={editionId}
          phaseId={phase.id}
          products={availableProducts}
          onCancel={() => setShowAdd(false)}
          onSuccess={(state) => {
            setShowAdd(false);
            if (state.warning) setNotice(state.warning);
            router.refresh();
          }}
        />
      ) : null}

      {items.length === 0 && !showAdd ? (
        <p className="text-sm text-ck-text-muted">Sin productos en esta fase.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-ck-border bg-ck-bg/50 text-ck-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Cant.</th>
                <th className="px-4 py-3 font-medium">Talle</th>
                <th className="px-4 py-3 font-medium">Stock disp.</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const listProduct = productsById.get(item.productId);
                const available = productAvailableStock(item.product);

                if (editingItemId === item.id) {
                  return (
                    <tr key={item.id} className="border-b border-ck-border/70">
                      <td colSpan={5} className="px-4 py-4">
                        <EditPhaseItemForm
                          editionId={editionId}
                          phaseId={phase.id}
                          item={item}
                          onCancel={() => setEditingItemId(null)}
                          onSuccess={(state) => {
                            setEditingItemId(null);
                            if (state.warning) setNotice(state.warning);
                            router.refresh();
                          }}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id} className="border-b border-ck-border/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ck-text">
                        {item.displayTitle?.trim() || item.product.name}
                      </div>
                      <div className="text-xs text-ck-text-muted">{item.product.code}</div>
                      <Link
                        href={catalogAdminRoutes.productDetail(item.productId)}
                        className="text-xs text-ck-yellow underline"
                      >
                        Ver producto
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {item.requiresVariantChoice ? (
                        <Badge variant="neutral">Elección en inscripción</Badge>
                      ) : (
                        <span className="text-ck-text-secondary">Sin elección</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {available <= 0 ? (
                        <Badge variant="danger">Sin stock</Badge>
                      ) : available <= LOW_STOCK_THRESHOLD ? (
                        <Badge variant="warning">{available} disp.</Badge>
                      ) : (
                        <span>{available}</span>
                      )}
                      {listProduct ? (
                        <div className="text-xs text-ck-text-muted">
                          total {listProduct.stockTotal} / res. {listProduct.reservedTotal}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingItemId(item.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "¿Quitar este producto de la fase? No elimina el producto del catálogo.",
                              )
                            ) {
                              return;
                            }
                            void removePricePhaseItemAction(editionId, phase.id, item.id).then(
                              (result) => {
                                if (!result.ok) {
                                  setError(result.message ?? "No se pudo quitar.");
                                  return;
                                }
                                if (result.warning) setNotice(result.warning);
                                router.refresh();
                              },
                            );
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

      {otherPhases.length > 0 ? (
        <AdminFormSection title="Duplicar desde otra fase">
          <div className="flex flex-wrap items-end gap-3">
            <Field id={`dup-${phase.id}`} label="Fase origen" className="min-w-[14rem] flex-1">
              <select
                id={`dup-${phase.id}`}
                value={duplicateSourceId}
                onChange={(e) => setDuplicateSourceId(e.target.value)}
                className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-sm"
              >
                {otherPhases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              variant="secondary"
              loading={pendingDup}
              disabled={!duplicateSourceId || pendingDup}
              onClick={() => {
                if (!duplicateSourceId) return;
                startDup(async () => {
                  const result = await duplicatePhaseItemsFromPhaseAction(
                    editionId,
                    phase.id,
                    duplicateSourceId,
                  );
                  if (!result.ok) {
                    setError(result.message ?? "No se pudo duplicar.");
                    return;
                  }
                  setNotice(
                    [result.message, result.warning].filter(Boolean).join(" ") || null,
                  );
                  router.refresh();
                });
              }}
            >
              Duplicar productos
            </Button>
          </div>
          <p className="mt-2 text-xs text-ck-text-muted">
            Copia idempotente: omite productos ya presentes o en conflicto con ticket base.
          </p>
        </AdminFormSection>
      ) : null}
    </section>
  );
}

function AddPhaseItemForm({
  editionId,
  phaseId,
  products,
  onCancel,
  onSuccess,
}: {
  editionId: string;
  phaseId: string;
  products: ProductListItem[];
  onCancel: () => void;
  onSuccess: (state: PricePhaseItemActionState) => void;
}) {
  const [state, formAction, pending] = useActionState(
    addPricePhaseItemAction.bind(null, editionId, phaseId),
    undefined,
  );
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    if (state?.ok) onSuccess(state);
  }, [state, onSuccess]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-ck-text-secondary">
        No hay productos elegibles.{" "}
        <Link href={catalogAdminRoutes.editionCatalog(editionId)} className="text-ck-yellow underline">
          Crear productos
        </Link>
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
        title="Agregar producto a la fase"
        description="Cantidad incluida por inscripción en esta fase de precio."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
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
              onChange={(e) => setProductId(e.target.value)}
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

        <Field id="quantity" label="Cantidad" required error={state?.errors?.quantity}>
          <Input name="quantity" inputMode="numeric" defaultValue="1" />
        </Field>

        <Field id="sortOrder" label="Orden" hint="Menor = primero en la lista" error={state?.errors?.sortOrder}>
          <Input name="sortOrder" inputMode="numeric" defaultValue="100" />
        </Field>

        <Field id="stockLimit" label="Cupo en fase (opcional)" error={state?.errors?.stockLimit}>
          <Input name="stockLimit" inputMode="numeric" placeholder="Sin límite" />
        </Field>

        {product && product.variants.length > 0 ? (
          <AdminFormFullWidth>
            <label className="flex items-center gap-2 text-sm text-ck-text">
              <input
                type="checkbox"
                name="requiresVariantChoice"
                className="size-4 rounded border-ck-border"
              />
              El participante elige talle/variante
            </label>
          </AdminFormFullWidth>
        ) : null}

        <AdminFormFullWidth>
          <label className="flex items-center gap-2 text-sm text-ck-text">
            <input
              type="checkbox"
              name="fulfillmentRequired"
              defaultChecked
              className="size-4 rounded border-ck-border"
            />
            Requiere entrega / fulfillment
          </label>
        </AdminFormFullWidth>

        <AdminFormFullWidth>
          <Field id="displayTitle" label="Título visible (opcional)">
            <Input name="displayTitle" placeholder={product?.name ?? ""} />
          </Field>
        </AdminFormFullWidth>

        <AdminFormFullWidth>
          <Field id="displayDescription" label="Descripción visible (opcional)">
            <Textarea name="displayDescription" rows={2} />
          </Field>
        </AdminFormFullWidth>
      </AdminForm>
    </form>
  );
}

function EditPhaseItemForm({
  editionId,
  phaseId,
  item,
  onCancel,
  onSuccess,
}: {
  editionId: string;
  phaseId: string;
  item: PricePhaseItemRecord;
  onCancel: () => void;
  onSuccess: (state: PricePhaseItemActionState) => void;
}) {
  const [state, formAction, pending] = useActionState(
    updatePricePhaseItemAction.bind(null, editionId, phaseId, item.id),
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onSuccess(state);
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-3">
      {state?.message && !state.ok ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}

      <input type="hidden" name="productId" value={item.productId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`qty-${item.id}`} label="Cantidad" error={state?.errors?.quantity}>
          <Input name="quantity" inputMode="numeric" defaultValue={String(item.quantity)} />
        </Field>
        <Field id={`ord-${item.id}`} label="Orden" error={state?.errors?.sortOrder}>
          <Input name="sortOrder" inputMode="numeric" defaultValue={String(item.sortOrder)} />
        </Field>
        <Field id={`lim-${item.id}`} label="Cupo fase" error={state?.errors?.stockLimit}>
          <Input
            name="stockLimit"
            inputMode="numeric"
            defaultValue={item.stockLimit != null ? String(item.stockLimit) : ""}
            placeholder="Sin límite"
          />
        </Field>
      </div>

      {item.product.variants.length > 0 ? (
        <label className="flex items-center gap-2 text-sm text-ck-text">
          <input
            type="checkbox"
            name="requiresVariantChoice"
            defaultChecked={item.requiresVariantChoice}
            className="size-4 rounded border-ck-border"
          />
          El participante elige talle/variante
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-ck-text">
        <input
          type="checkbox"
          name="fulfillmentRequired"
          defaultChecked={item.fulfillmentRequired}
          className="size-4 rounded border-ck-border"
        />
        Requiere entrega / fulfillment
      </label>

      <Field id={`title-${item.id}`} label="Título visible">
        <Input name="displayTitle" defaultValue={item.displayTitle ?? ""} />
      </Field>
      <Field id={`desc-${item.id}`} label="Descripción visible">
        <Textarea name="displayDescription" rows={2} defaultValue={item.displayDescription ?? ""} />
      </Field>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
