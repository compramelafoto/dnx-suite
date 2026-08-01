"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { CatalogActionState } from "@/lib/admin-catalog/actions/action-result";
import { minorUnitsToPesosInput } from "@/lib/admin-catalog/ui/money-ui";

type Props = {
  action: (
    prev: CatalogActionState | undefined,
    formData: FormData,
  ) => Promise<CatalogActionState>;
  mode: "create" | "edit";
  initialValues?: {
    name?: string;
    code?: string;
    sku?: string;
    stock?: number;
    priceAmount?: number | null;
    currency?: string | null;
    isActive?: boolean;
  };
  submitLabel?: string;
  onCancel?: () => void;
};

export function VariantForm({
  action,
  mode,
  initialValues = {},
  submitLabel,
  onCancel,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState({
    name: initialValues.name ?? "",
    code: initialValues.code ?? "",
    sku: initialValues.sku ?? "",
    stock: initialValues.stock != null ? String(initialValues.stock) : "0",
    pricePesos: minorUnitsToPesosInput(initialValues.priceAmount),
    currency: initialValues.currency ?? "ARS",
    isActive: initialValues.isActive ?? true,
  });

  useEffect(() => {
    if (state?.values) {
      setValues((prev) => ({ ...prev, ...state.values }));
    }
  }, [state?.values]);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && !state.ok ? (
        <p
          className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <AdminForm
        title={mode === "create" ? "Agregar talle u opción" : "Editar talle u opción"}
        description="Ejemplos: Talle S, Amarilla 750 ml, A5 tapa dura, 20×30 mate, Digital. No asume que sea una remera."
        footer={
          <>
            {onCancel ? (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={pending} disabled={pending}>
              {submitLabel ??
                (mode === "create" ? "Crear talle u opción" : "Guardar cambios")}
            </Button>
          </>
        }
      >
        <Field
          id="variant-name"
          label="Nombre del talle u opción"
          required
          error={state?.errors?.name}
          hint="Ejemplo: S, M, L o un color. Es lo que ve el participante."
        >
          <Input
            name="name"
            value={values.name}
            onChange={(e) => setValues((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>
        <Field
          id="variant-code"
          label="Código corto"
          required
          error={state?.errors?.code}
          hint="Identificador corto único dentro del producto (uso interno)."
        >
          <Input
            name="code"
            value={values.code}
            onChange={(e) => setValues((p) => ({ ...p, code: e.target.value }))}
          />
        </Field>
        <Field
          id="variant-sku"
          label="Código interno (SKU)"
          required
          error={state?.errors?.sku}
          hint="Único global. Solo para soporte e inventario; no es el nombre que ve el participante."
        >
          <Input
            name="sku"
            value={values.sku}
            onChange={(e) => setValues((p) => ({ ...p, sku: e.target.value }))}
          />
        </Field>

        {mode === "create" ? (
          <Field
            id="variant-stock"
            label="Stock inicial"
            required
            error={state?.errors?.stock}
            hint="Entero ≥ 0. Después usá «Ajustar stock»."
          >
            <Input
              name="stock"
              inputMode="numeric"
              value={values.stock}
              onChange={(e) => setValues((p) => ({ ...p, stock: e.target.value }))}
            />
          </Field>
        ) : null}

        <Field
          id="variant-price"
          label="Precio adicional (pesos)"
          error={state?.errors?.pricePesos ?? state?.errors?.priceAmount}
          hint="Pesos enteros humanos, ej. 40000 → se guarda como 4.000.000 centavos. Vacío = sin precio adicional."
        >
          <Input
            name="pricePesos"
            inputMode="numeric"
            value={values.pricePesos}
            onChange={(e) => setValues((p) => ({ ...p, pricePesos: e.target.value }))}
            placeholder="ej. 40000"
          />
        </Field>

        <Field id="variant-currency" label="Moneda" error={state?.errors?.currency}>
          <select
            id="variant-currency"
            name="currency"
            value={values.currency}
            onChange={(e) => setValues((p) => ({ ...p, currency: e.target.value }))}
            className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
          >
            <option value="ARS">ARS</option>
          </select>
        </Field>

        <AdminFormFullWidth>
          <label className="flex items-center gap-3 text-sm text-ck-text">
            <input
              type="checkbox"
              name="isActive"
              checked={values.isActive}
              onChange={(e) => setValues((p) => ({ ...p, isActive: e.target.checked }))}
              className="size-4"
            />
            Variante activa
          </label>
        </AdminFormFullWidth>
      </AdminForm>
    </form>
  );
}
