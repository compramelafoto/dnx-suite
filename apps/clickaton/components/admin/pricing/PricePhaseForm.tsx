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
        title="Nueva fase de precio"
        description="Definí el importe y el período. El sistema aplica la fase vigente según las fechas."
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
        <Field
          id="name"
          label="Nombre de la fase"
          required
          hint="Será visible para el equipo administrador y, si corresponde, para los participantes."
          error={state?.errors?.name}
        >
          <Input
            name="name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </Field>
        <Field
          id="amountPesos"
          label="Precio de inscripción"
          required
          hint="Este importe se aplicará durante el período configurado. Ej. 25000 → $ 25.000"
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
          <Field
            id="startsAt"
            label="Fecha de inicio"
            required
            hint="Se aplicará desde este momento (hora de la edición)."
            error={state?.errors?.startsAt}
          >
            <Input
              type="datetime-local"
              name="startsAt"
              value={values.startsAt}
              onChange={(e) => updateField("startsAt", e.target.value)}
            />
          </Field>
          <Field
            id="endsAt"
            label="Fecha de finalización"
            required
            hint="Se dejará de aplicar después de este momento."
            error={state?.errors?.endsAt}
          >
            <Input
              type="datetime-local"
              name="endsAt"
              value={values.endsAt}
              onChange={(e) => updateField("endsAt", e.target.value)}
            />
          </Field>
          <Field
            id="priority"
            label="Prioridad"
            hint="Si hubiera un empate técnico, gana la prioridad menor."
            error={state?.errors?.priority}
          >
            <Input
              name="priority"
              inputMode="numeric"
              value={values.priority}
              onChange={(e) => updateField("priority", e.target.value)}
            />
          </Field>
          <Field id="capacity" label="Cupo de la fase (opcional)" error={state?.errors?.capacity}>
            <Input
              name="capacity"
              inputMode="numeric"
              value={values.capacity}
              onChange={(e) => updateField("capacity", e.target.value)}
            />
          </Field>
        </AdminFormSection>

        <AdminFormFullWidth>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ck-text">
            <input
              type="checkbox"
              name="isActive"
              checked={values.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="size-4 rounded border-ck-border"
            />
            Habilitar fase al crear
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
