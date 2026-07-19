"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { CatalogActionState } from "@/lib/admin-catalog/actions/action-result";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";

export type EditionOption = {
  id: string;
  name: string;
  status: string;
};

type Props = {
  action: (
    prev: CatalogActionState | undefined,
    formData: FormData,
  ) => Promise<CatalogActionState>;
  editions: EditionOption[];
  initialValues?: {
    editionId?: string;
    name?: string;
    description?: string;
    code?: string;
    isActive?: boolean;
  };
  submitLabel?: string;
  cancelHref?: string;
  lockEdition?: boolean;
  mode?: "create" | "edit";
};

const BLOCKED = new Set(["CANCELLED", "COMPLETED"]);

export function ProductForm({
  action,
  editions,
  initialValues = {},
  submitLabel = "Guardar producto",
  cancelHref,
  lockEdition = false,
  mode = "create",
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState({
    editionId: initialValues.editionId ?? "",
    name: initialValues.name ?? "",
    description: initialValues.description ?? "",
    code: initialValues.code ?? "",
    isActive: initialValues.isActive ?? true,
  });

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
        description="Un producto es un ítem de merchandising o kit (remera, botella, diploma…). Las variantes (talle, color, formato) se agregan después."
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
        ) : null}
      </AdminForm>
    </form>
  );
}
