"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth, AdminFormSection } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { CatalogActionState } from "@/lib/admin-catalog/actions/action-result";
import type { ProductStoreStatus } from "@/lib/admin-catalog/domain/types";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";
import {
  ProductMediaUploadFields,
  type ProductMediaRow,
} from "@/components/admin/catalog/ProductMediaUploadFields";

export type EditionOption = {
  id: string;
  name: string;
  status: string;
};

type ProductFormValues = {
  editionId: string;
  name: string;
  description: string;
  code: string;
  isActive: boolean;
  primaryImageAssetId: string;
  sizeChartAssetId: string;
  sizeChartDescription: string;
  sizeChartInstructions: string;
  isStoreEnabled: boolean;
  storeStatus: ProductStoreStatus;
  storeSlug: string;
  storeTitle: string;
  storeDescription: string;
  storePricePesos: string;
  compareAtPricePesos: string;
  requiresShipping: boolean;
  allowPickup: boolean;
};

type Props = {
  action: (
    prev: CatalogActionState | undefined,
    formData: FormData,
  ) => Promise<CatalogActionState>;
  editions: EditionOption[];
  initialValues?: Partial<ProductFormValues>;
  submitLabel?: string;
  cancelHref?: string;
  lockEdition?: boolean;
  mode?: "create" | "edit";
  productId?: string;
  mediaRows?: ProductMediaRow[];
};

const BLOCKED = new Set(["CANCELLED", "COMPLETED"]);

const STORE_STATUS_LABELS: Record<ProductStoreStatus, string> = {
  DRAFT: "En preparación",
  ACTIVE: "Disponible para venta separada",
  OUT_OF_STOCK: "Sin stock",
  HIDDEN: "Oculto",
  ARCHIVED: "Archivado",
};

function defaultFormValues(initial: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    editionId: initial.editionId ?? "",
    name: initial.name ?? "",
    description: initial.description ?? "",
    code: initial.code ?? "",
    isActive: initial.isActive ?? true,
    primaryImageAssetId: initial.primaryImageAssetId ?? "",
    sizeChartAssetId: initial.sizeChartAssetId ?? "",
    sizeChartDescription: initial.sizeChartDescription ?? "",
    sizeChartInstructions: initial.sizeChartInstructions ?? "",
    isStoreEnabled: initial.isStoreEnabled ?? false,
    storeStatus: initial.storeStatus ?? "DRAFT",
    storeSlug: initial.storeSlug ?? "",
    storeTitle: initial.storeTitle ?? "",
    storeDescription: initial.storeDescription ?? "",
    storePricePesos: initial.storePricePesos ?? "",
    compareAtPricePesos: initial.compareAtPricePesos ?? "",
    requiresShipping: initial.requiresShipping ?? false,
    allowPickup: initial.allowPickup ?? true,
  };
}

export function ProductForm({
  action,
  editions,
  initialValues = {},
  submitLabel = "Guardar producto",
  cancelHref,
  lockEdition = false,
  mode = "create",
  productId,
  mediaRows,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(defaultFormValues(initialValues));

  useEffect(() => {
    if (state?.values) {
      setValues((prev) => ({
        ...prev,
        ...state.values,
        isActive: state.values?.isActive === "false" ? false : prev.isActive,
      }));
    }
  }, [state?.values]);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const writableEditions = editions.filter((e) => !BLOCKED.has(e.status));

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && !state.ok ? (
        <p
          className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm text-ck-text"
          role="alert"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          {state.message}
        </p>
      ) : null}

      <AdminForm
        title={mode === "create" ? "Nuevo producto" : "Datos del producto"}
        description="Configurá el artículo y, después, sus talles u opciones. Puede incluirse en una fase de precio o en una entrada."
        footer={
          <>
            {cancelHref ? (
              <Button href={cancelHref} variant="secondary">
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={pending} disabled={pending}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <AdminFormFullWidth>
          <Field
            id="editionId"
            label="Edición"
            required
            error={state?.errors?.editionId}
            hint={
              lockEdition
                ? "La edición no se puede cambiar después de crear el producto."
                : "Solo ediciones no canceladas ni completadas."
            }
          >
            <select
              id="editionId"
              name="editionId"
              value={values.editionId}
              disabled={lockEdition}
              onChange={(e) => setValues((p) => ({ ...p, editionId: e.target.value }))}
              className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
            >
              <option value="">Seleccionar edición</option>
              {(lockEdition ? editions : writableEditions).map((edition) => {
                const statusLabel =
                  EDITION_STATUS_LABELS[edition.status as ClickatonEditionStatus] ??
                  edition.status;
                return (
                  <option key={edition.id} value={edition.id}>
                    {edition.name} ({statusLabel})
                  </option>
                );
              })}
            </select>
          </Field>
        </AdminFormFullWidth>

        {lockEdition ? <input type="hidden" name="editionId" value={values.editionId} /> : null}

        <Field id="name" label="Nombre" required error={state?.errors?.name}>
          <Input
            name="name"
            value={values.name}
            onChange={(e) => setValues((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>

        <Field
          id="code"
          label="Código"
          required
          error={state?.errors?.code}
          hint="Se normaliza a mayúsculas. Único por edición."
        >
          <Input
            name="code"
            value={values.code}
            onChange={(e) => setValues((p) => ({ ...p, code: e.target.value }))}
            autoCapitalize="characters"
          />
        </Field>

        <AdminFormFullWidth>
          <Field
            id="description"
            label="Descripción"
            error={state?.errors?.description}
            hint="Opcional."
          >
            <textarea
              id="description"
              name="description"
              value={values.description}
              onChange={(e) => setValues((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              className="min-h-28 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
            />
          </Field>
        </AdminFormFullWidth>

        {mode === "create" ? (
          <AdminFormFullWidth>
            <label className="flex items-center gap-3 text-sm text-ck-text">
              <input
                type="checkbox"
                name="isActive"
                checked={values.isActive}
                onChange={(e) => setValues((p) => ({ ...p, isActive: e.target.checked }))}
                className="size-4"
              />
              Producto activo (seleccionable en futuros flujos)
            </label>
          </AdminFormFullWidth>
        ) : (
          <>
            <AdminFormSection title="Medios e inscripción">
              {productId ? (
                <AdminFormFullWidth>
                  <ProductMediaUploadFields
                    productId={productId}
                    primaryImageAssetId={values.primaryImageAssetId || null}
                    sizeChartAssetId={values.sizeChartAssetId || null}
                    mediaRows={mediaRows}
                  />
                </AdminFormFullWidth>
              ) : null}
              <Field
                id="primaryImageAssetId"
                label="Imagen principal"
                error={state?.errors?.primaryImageAssetId}
                hint="ID de DnxMediaAsset ya subido, o usá el uploader de arriba."
              >
                <Input
                  name="primaryImageAssetId"
                  value={values.primaryImageAssetId}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, primaryImageAssetId: e.target.value }))
                  }
                  placeholder="clxx…"
                />
              </Field>
              <Field
                id="sizeChartAssetId"
                label="Cuadro de talles"
                error={state?.errors?.sizeChartAssetId}
              >
                <Input
                  name="sizeChartAssetId"
                  value={values.sizeChartAssetId}
                  onChange={(e) => setValues((p) => ({ ...p, sizeChartAssetId: e.target.value }))}
                  placeholder="clxx…"
                />
              </Field>
              <Field id="sizeChartDescription" label="Descripción del cuadro de talles">
                <textarea
                  id="sizeChartDescription"
                  name="sizeChartDescription"
                  value={values.sizeChartDescription}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, sizeChartDescription: e.target.value }))
                  }
                  rows={3}
                  className="min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
                />
              </Field>
              <Field id="sizeChartInstructions" label="Instrucciones de talle">
                <textarea
                  id="sizeChartInstructions"
                  name="sizeChartInstructions"
                  value={values.sizeChartInstructions}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, sizeChartInstructions: e.target.value }))
                  }
                  rows={3}
                  className="min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
                />
              </Field>
            </AdminFormSection>

            <AdminFormSection title="Tienda pública (preparación)">
              <p className="text-sm text-ck-text-secondary">
                El storefront público sigue deshabilitado. Podés dejar datos listos; no se
                publicará hasta habilitar la tienda en una etapa posterior.
              </p>
              <label className="flex items-center gap-3 text-sm text-ck-text">
                <input
                  type="checkbox"
                  name="isStoreEnabled"
                  checked={values.isStoreEnabled}
                  onChange={(e) => setValues((p) => ({ ...p, isStoreEnabled: e.target.checked }))}
                  className="size-4"
                />
                Habilitar tienda (prep; storefront OFF)
              </label>
              <Field id="storeStatus" label="Estado comercial tienda" error={state?.errors?.storeStatus}>
                <select
                  id="storeStatus"
                  name="storeStatus"
                  value={values.storeStatus}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      storeStatus: e.target.value as ProductStoreStatus,
                    }))
                  }
                  className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
                >
                  {(Object.keys(STORE_STATUS_LABELS) as ProductStoreStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STORE_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="storeSlug"
                label="Identificador URL de tienda"
                error={state?.errors?.storeSlug}
                hint="Único por edición. Opcional hasta publicar."
              >
                <Input
                  name="storeSlug"
                  value={values.storeSlug}
                  onChange={(e) => setValues((p) => ({ ...p, storeSlug: e.target.value }))}
                />
              </Field>
              <Field id="storeTitle" label="Título tienda">
                <Input
                  name="storeTitle"
                  value={values.storeTitle}
                  onChange={(e) => setValues((p) => ({ ...p, storeTitle: e.target.value }))}
                />
              </Field>
              <Field id="storeDescription" label="Descripción tienda">
                <textarea
                  id="storeDescription"
                  name="storeDescription"
                  value={values.storeDescription}
                  onChange={(e) => setValues((p) => ({ ...p, storeDescription: e.target.value }))}
                  rows={3}
                  className="min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
                />
              </Field>
              <Field
                id="storePricePesos"
                label="Precio tienda (pesos)"
                error={state?.errors?.storePricePesos}
                hint="Independiente del precio de inscripción. Ej. 15000."
              >
                <Input
                  name="storePricePesos"
                  inputMode="numeric"
                  value={values.storePricePesos}
                  onChange={(e) => setValues((p) => ({ ...p, storePricePesos: e.target.value }))}
                />
              </Field>
              <Field
                id="compareAtPricePesos"
                label="Precio tachado (pesos)"
                error={state?.errors?.compareAtPricePesos}
              >
                <Input
                  name="compareAtPricePesos"
                  inputMode="numeric"
                  value={values.compareAtPricePesos}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, compareAtPricePesos: e.target.value }))
                  }
                />
              </Field>
              <label className="flex items-center gap-3 text-sm text-ck-text">
                <input
                  type="checkbox"
                  name="requiresShipping"
                  checked={values.requiresShipping}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, requiresShipping: e.target.checked }))
                  }
                  className="size-4"
                />
                Requiere envío
              </label>
              <label className="flex items-center gap-3 text-sm text-ck-text">
                <input
                  type="checkbox"
                  name="allowPickup"
                  checked={values.allowPickup}
                  onChange={(e) => setValues((p) => ({ ...p, allowPickup: e.target.checked }))}
                  className="size-4"
                />
                Permite retiro en sede
              </label>
            </AdminFormSection>
          </>
        )}
      </AdminForm>
    </form>
  );
}
