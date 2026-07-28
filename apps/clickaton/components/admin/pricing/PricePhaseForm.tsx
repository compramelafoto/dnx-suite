"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth, AdminFormSection } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import type { PricePhaseActionState } from "@/lib/admin/pricing/mutations";
import {
  emptyPricePhaseFormInput,
  type PricePhaseFormInput,
} from "@/lib/admin/pricing/validation";

type Props = {
  action: (
    prev: PricePhaseActionState | undefined,
    formData: FormData,
  ) => Promise<PricePhaseActionState>;
  initialValues?: PricePhaseFormInput;
  submitLabel?: string;
  cancelHref?: string;
};

export function PricePhaseForm({
  action,
  initialValues = emptyPricePhaseFormInput(),
  submitLabel = "Guardar fase",
  cancelHref,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function updateField<K extends keyof PricePhaseFormInput>(
    key: K,
    value: PricePhaseFormInput[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

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
      {state?.errors?._form ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.errors._form}
        </p>
      ) : null}

      <AdminForm
        title="Fase de precio"
        description="El backend resuelve la fase vigente. No se confía en montos del frontend."
        footer={
          <>
            {cancelHref ? (
              <Button href={cancelHref} variant="secondary">
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={pending}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <Field id="name" label="Nombre" required error={state?.errors?.name}>
          <Input
            name="name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </Field>
        <Field
          id="amountPesos"
          label="Precio (pesos enteros)"
          required
          hint="Ej. 25000 → $ 25.000 ARS"
          error={state?.errors?.amountPesos}
        >
          <Input
            name="amountPesos"
            inputMode="numeric"
            value={values.amountPesos}
            onChange={(e) => updateField("amountPesos", e.target.value)}
          />
        </Field>
        <input type="hidden" name="currency" value={values.currency || "ARS"} />

        <AdminFormSection title="Vigencia">
          <Field id="startsAt" label="Desde" required error={state?.errors?.startsAt}>
            <Input
              type="datetime-local"
              name="startsAt"
              value={values.startsAt}
              onChange={(e) => updateField("startsAt", e.target.value)}
            />
          </Field>
          <Field id="endsAt" label="Hasta" required error={state?.errors?.endsAt}>
            <Input
              type="datetime-local"
              name="endsAt"
              value={values.endsAt}
              onChange={(e) => updateField("endsAt", e.target.value)}
            />
          </Field>
          <Field id="priority" label="Prioridad" hint="Menor = gana si hay empate" error={state?.errors?.priority}>
            <Input
              name="priority"
              inputMode="numeric"
              value={values.priority}
              onChange={(e) => updateField("priority", e.target.value)}
            />
          </Field>
          <Field id="capacity" label="Cupo de fase (opcional)" error={state?.errors?.capacity}>
            <Input
              name="capacity"
              inputMode="numeric"
              value={values.capacity}
              onChange={(e) => updateField("capacity", e.target.value)}
            />
          </Field>
        </AdminFormSection>

        <AdminFormFullWidth>
          <label className="flex items-center gap-2 text-sm text-ck-text">
            <input
              type="checkbox"
              name="isActive"
              checked={values.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="size-4 rounded border-ck-border"
            />
            Fase activa
          </label>
        </AdminFormFullWidth>

        <AdminFormFullWidth>
          <Field id="description" label="Descripción">
            <Textarea
              name="description"
              rows={2}
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </Field>
        </AdminFormFullWidth>
      </AdminForm>
    </form>
  );
}
