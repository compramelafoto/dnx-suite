"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth, AdminFormSection } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { slugify } from "@/lib/admin/slug";
import {
  emptyVenueFormInput,
  type ClickatonVenueFormInput,
} from "@/lib/admin/venues/types";
import type { VenueActionState } from "@/lib/admin/venues/mutations";

type EditionOption = { id: string; name: string };

type Props = {
  action: (
    prev: VenueActionState | undefined,
    formData: FormData,
  ) => Promise<VenueActionState>;
  editions: EditionOption[];
  initialValues?: ClickatonVenueFormInput;
  submitLabel?: string;
  cancelHref?: string;
  lockEdition?: boolean;
};

export function VenueForm({
  action,
  editions,
  initialValues = emptyVenueFormInput(),
  submitLabel = "Guardar sede",
  cancelHref,
  lockEdition = false,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(initialValues);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues.slug));

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function updateField<K extends keyof ClickatonVenueFormInput>(
    key: K,
    value: ClickatonVenueFormInput[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.message && !state.ok ? (
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm text-ck-text" role="alert">
          {state.message}
        </p>
      ) : null}

      <AdminForm
        title="Datos de la sede"
        description="Una edición puede tener una o varias sedes. Sin franquicias ni exclusividad territorial."
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
        <AdminFormFullWidth>
          <Field id="editionId" label="Edición" required error={state?.errors?.editionId}>
            <select
              id="editionId"
              name="editionId"
              value={values.editionId}
              disabled={lockEdition}
              onChange={(e) => updateField("editionId", e.target.value)}
              className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base text-ck-text"
            >
              <option value="">Seleccionar edición</option>
              {editions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.name}
                </option>
              ))}
            </select>
          </Field>
        </AdminFormFullWidth>

        <Field id="name" label="Nombre" required error={state?.errors?.name}>
          <Input
            name="name"
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </Field>

        <Field
          id="slug"
          label="Identificador de URL"
          required
          error={state?.errors?.slug}
          hint="Se usa en enlaces internos. No es el nombre visible de la sede."
        >
          <Input
            name="slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              updateField("slug", e.target.value);
            }}
          />
        </Field>

        <Field id="city" label="Ciudad" required error={state?.errors?.city}>
          <Input name="city" value={values.city} onChange={(e) => updateField("city", e.target.value)} />
        </Field>

        <Field id="provinceOrState" label="Provincia / estado">
          <Input
            name="provinceOrState"
            value={values.provinceOrState}
            onChange={(e) => updateField("provinceOrState", e.target.value)}
          />
        </Field>

        <Field id="country" label="País">
          <Input name="country" value={values.country} onChange={(e) => updateField("country", e.target.value)} />
        </Field>

        <AdminFormFullWidth>
          <Field id="address" label="Dirección">
            <Input name="address" value={values.address} onChange={(e) => updateField("address", e.target.value)} />
          </Field>
        </AdminFormFullWidth>

        <AdminFormFullWidth>
          <Field id="meetingPoint" label="Punto de encuentro">
            <Input
              name="meetingPoint"
              value={values.meetingPoint}
              onChange={(e) => updateField("meetingPoint", e.target.value)}
            />
          </Field>
        </AdminFormFullWidth>

        <AdminFormSection title="Operación">
          <Field id="capacity" label="Capacidad" error={state?.errors?.capacity}>
            <Input
              name="capacity"
              inputMode="numeric"
              value={values.capacity}
              onChange={(e) => updateField("capacity", e.target.value)}
            />
          </Field>
          <Field id="startsAt" label="Inicio" error={state?.errors?.startsAt}>
            <Input
              type="datetime-local"
              name="startsAt"
              value={values.startsAt}
              onChange={(e) => updateField("startsAt", e.target.value)}
            />
          </Field>
          <Field id="endsAt" label="Fin" error={state?.errors?.endsAt}>
            <Input
              type="datetime-local"
              name="endsAt"
              value={values.endsAt}
              onChange={(e) => updateField("endsAt", e.target.value)}
            />
          </Field>
          <AdminFormFullWidth>
            <label className="flex items-center gap-2 text-sm text-ck-text">
              <input
                type="checkbox"
                name="isActive"
                checked={values.isActive}
                onChange={(e) => updateField("isActive", e.target.checked)}
                className="size-4 rounded border-ck-border"
              />
              Sede activa
            </label>
          </AdminFormFullWidth>
        </AdminFormSection>

        <AdminFormSection title="Contacto">
          <Field id="contactName" label="Nombre de contacto">
            <Input
              name="contactName"
              value={values.contactName}
              onChange={(e) => updateField("contactName", e.target.value)}
            />
          </Field>
          <Field id="contactEmail" label="Email" error={state?.errors?.contactEmail}>
            <Input
              type="email"
              name="contactEmail"
              value={values.contactEmail}
              onChange={(e) => updateField("contactEmail", e.target.value)}
            />
          </Field>
          <Field id="contactPhone" label="Teléfono">
            <Input
              name="contactPhone"
              value={values.contactPhone}
              onChange={(e) => updateField("contactPhone", e.target.value)}
            />
          </Field>
        </AdminFormSection>
      </AdminForm>
    </form>
  );
}
