"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { CatalogActionState } from "@/lib/admin-catalog/actions/action-result";
import { minorUnitsToPesosInput } from "@/lib/admin-catalog/ui/money-ui";
import { toDatetimeLocalValue } from "@/lib/admin-catalog/ui/ticket-status";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";

export type EditionOption = { id: string; name: string; status: string };

type Props = {
  action: (
    prev: CatalogActionState | undefined,
    formData: FormData,
  ) => Promise<CatalogActionState>;
  editions: EditionOption[];
  mode: "create" | "edit";
  lockEdition?: boolean;
  lockImmutableFields?: boolean;
  cancelHref?: string;
  submitLabel?: string;
  initialValues?: {
    editionId?: string;
    name?: string;
    description?: string;
    code?: string;
    priceAmount?: number;
    currency?: string;
    capacity?: number | null;
    holdMinutes?: number;
    salesStartAt?: Date | null;
    salesEndAt?: Date | null;
    isActive?: boolean;
    venueId?: string | null;
  };
};

const BLOCKED = new Set(["CANCELLED", "COMPLETED"]);

export function TicketTypeForm({
  action,
  editions,
  mode,
  lockEdition = false,
  lockImmutableFields = false,
  cancelHref,
  submitLabel,
  initialValues = {},
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [unlimited, setUnlimited] = useState(
    mode === "edit" ? initialValues.capacity === null : false,
  );
  const [values, setValues] = useState({
    editionId: initialValues.editionId ?? "",
    name: initialValues.name ?? "",
    description: initialValues.description ?? "",
    code: initialValues.code ?? "",
    pricePesos: minorUnitsToPesosInput(initialValues.priceAmount ?? 0),
    currency: initialValues.currency ?? "ARS",
    capacity:
      initialValues.capacity == null ? "" : String(initialValues.capacity),
    holdMinutes: String(initialValues.holdMinutes ?? 20),
    salesStartAt: toDatetimeLocalValue(initialValues.salesStartAt ?? null),
    salesEndAt: toDatetimeLocalValue(initialValues.salesEndAt ?? null),
    isActive: initialValues.isActive ?? true,
    venueId: initialValues.venueId ?? "",
  });

  useEffect(() => {
    if (state?.values) setValues((prev) => ({ ...prev, ...state.values }));
  }, [state?.values]);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const writableEditions = editions.filter((e) => !BLOCKED.has(e.status));

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

      {lockImmutableFields ? (
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] px-4 py-3 text-sm" role="status">
          Hay inscripciones confirmadas: algunos campos pueden estar bloqueados por el
          backend (precio, código, sede, moneda). Si falla el guardado, duplicá la entrada.
        </p>
      ) : null}

      <AdminForm
        title={mode === "create" ? "Nueva entrada" : "Datos de la entrada"}
        description="Tipo de entrada comercial. La composición del kit se configura en el detalle. Precio en pesos enteros (ej. 40000 → $ 40.000 ARS)."
        footer={
          <>
            {cancelHref ? (
              <Button href={cancelHref} variant="secondary">
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={pending} disabled={pending}>
              {submitLabel ?? (mode === "create" ? "Crear entrada" : "Guardar cambios")}
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
            hint={lockEdition ? "La edición no se puede cambiar." : undefined}
          >
            <select
              id="editionId"
              name="editionId"
              value={values.editionId}
              disabled={lockEdition}
              onChange={(e) => setValues((p) => ({ ...p, editionId: e.target.value }))}
              className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
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
          hint="Único por edición; se normaliza."
        >
          <Input
            name="code"
            value={values.code}
            disabled={lockImmutableFields}
            onChange={(e) => setValues((p) => ({ ...p, code: e.target.value }))}
          />
        </Field>

        <AdminFormFullWidth>
          <Field id="description" label="Descripción" error={state?.errors?.description}>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={values.description}
              onChange={(e) => setValues((p) => ({ ...p, description: e.target.value }))}
              className="min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
            />
          </Field>
        </AdminFormFullWidth>

        <Field
          id="pricePesos"
          label="Precio (pesos)"
          required
          error={state?.errors?.pricePesos ?? state?.errors?.priceAmount}
          hint="Pesos enteros. 0 = Gratis. Se guarda en centavos (×100)."
        >
          <Input
            name="pricePesos"
            inputMode="numeric"
            value={values.pricePesos}
            disabled={lockImmutableFields}
            onChange={(e) => setValues((p) => ({ ...p, pricePesos: e.target.value }))}
          />
        </Field>

        <Field id="currency" label="Moneda" error={state?.errors?.currency}>
          <select
            id="currency"
            name="currency"
            value={values.currency}
            disabled={lockImmutableFields}
            onChange={(e) => setValues((p) => ({ ...p, currency: e.target.value }))}
            className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
          >
            <option value="ARS">ARS</option>
          </select>
        </Field>

        <AdminFormFullWidth>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="unlimitedCapacity"
              checked={unlimited}
              onChange={(e) => setUnlimited(e.target.checked)}
              className="size-4"
            />
            Cupo ilimitado
          </label>
        </AdminFormFullWidth>

        {!unlimited ? (
          <Field
            id="capacity"
            label="Cupo total"
            error={state?.errors?.capacity}
            hint="Entero ≥ 1. Distinto del stock de productos."
          >
            <Input
              name="capacity"
              inputMode="numeric"
              value={values.capacity}
              onChange={(e) => setValues((p) => ({ ...p, capacity: e.target.value }))}
            />
          </Field>
        ) : (
          <input type="hidden" name="capacity" value="" />
        )}

        <Field
          id="holdMinutes"
          label="Hold (minutos)"
          error={state?.errors?.holdMinutes}
          hint="Reserva temporal de cupo (5–120). Default 20."
        >
          <Input
            name="holdMinutes"
            inputMode="numeric"
            value={values.holdMinutes}
            onChange={(e) => setValues((p) => ({ ...p, holdMinutes: e.target.value }))}
          />
        </Field>

        <Field
          id="salesStartAt"
          label="Inicio de venta"
          error={state?.errors?.salesStartAt}
          hint="Opcional. Hora local del navegador (Argentina)."
        >
          <Input
            type="datetime-local"
            name="salesStartAt"
            value={values.salesStartAt}
            onChange={(e) => setValues((p) => ({ ...p, salesStartAt: e.target.value }))}
          />
        </Field>

        <Field
          id="salesEndAt"
          label="Fin de venta"
          error={state?.errors?.salesEndAt}
          hint="Debe ser ≥ inicio si ambos están definidos."
        >
          <Input
            type="datetime-local"
            name="salesEndAt"
            value={values.salesEndAt}
            onChange={(e) => setValues((p) => ({ ...p, salesEndAt: e.target.value }))}
          />
        </Field>

        {mode === "create" ? (
          <AdminFormFullWidth>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="isActive"
                checked={values.isActive}
                onChange={(e) => setValues((p) => ({ ...p, isActive: e.target.checked }))}
                className="size-4"
              />
              Entrada activa
            </label>
          </AdminFormFullWidth>
        ) : null}
      </AdminForm>
    </form>
  );
}
