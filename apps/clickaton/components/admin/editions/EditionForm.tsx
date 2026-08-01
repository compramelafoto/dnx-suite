"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth, AdminFormSection } from "@/components/admin/AdminForm";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { slugify } from "@/lib/admin/slug";
import {
  CLICKATON_EDITION_STATUSES,
  EDITION_STATUS_LABELS,
  emptyEditionFormInput,
  type ClickatonEditionFormInput,
} from "@/lib/admin/editions/types";
import { EditionCoverUploadFields } from "@/components/admin/editions/EditionCoverUploadFields";
import {
  createEditionFormAction,
  updateEditionFormAction,
} from "@/lib/admin/editions/form-actions";

type Props = {
  mode: "create" | "edit";
  initialValues?: ClickatonEditionFormInput;
  submitLabel?: string;
  cancelHref?: string;
  editionId?: string | null;
};

export function EditionForm({
  mode,
  initialValues = emptyEditionFormInput(),
  submitLabel = "Guardar edición",
  cancelHref,
  editionId = null,
}: Props) {
  const router = useRouter();
  // Importar la action en el client (no pasarla como prop desde RSC):
  // evita "module not in React Client Manifest" en /editar.
  const action = mode === "edit" ? updateEditionFormAction : createEditionFormAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(initialValues);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues.slug));

  useEffect(() => {
    if (state?.ok && state.message) {
      router.refresh();
    }
  }, [state, router]);

  function updateField<K extends keyof ClickatonEditionFormInput>(
    key: K,
    value: ClickatonEditionFormInput[K],
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
      {editionId ? <input type="hidden" name="editionId" value={editionId} /> : null}
      {state?.message && !state.ok ? (
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm text-ck-text" role="alert">
          {state.message}
        </p>
      ) : null}

      <AdminForm
        title="Datos de la edición"
        description="Producto de marca Clickatón. La competencia asociada vive en FotoRank."
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
            autoComplete="off"
          />
        </Field>

        <Field
          id="slug"
          label="Identificador de URL"
          required
          hint="URL interna: minúsculas, números y guiones."
          error={state?.errors?.slug}
        >
          <Input
            name="slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              updateField("slug", e.target.value);
            }}
            autoComplete="off"
          />
        </Field>

        <Field id="status" label="Estado" error={state?.errors?.status}>
          <Select
            name="status"
            value={values.status}
            onChange={(e) =>
              updateField("status", e.target.value as ClickatonEditionFormInput["status"])
            }
          >
            {CLICKATON_EDITION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {EDITION_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="timezone" label="Zona horaria" hint="Ej. America/Argentina/Cordoba">
          <Input
            name="timezone"
            value={values.timezone}
            onChange={(e) => updateField("timezone", e.target.value)}
          />
        </Field>

        <Field
          id="currency"
          label="Moneda"
          hint="Por ahora se utiliza ARS (pesos argentinos)."
          error={state?.errors?.currency}
        >
          <Input
            name="currency"
            value={values.currency}
            onChange={(e) => updateField("currency", e.target.value)}
          />
        </Field>

        <AdminFormFullWidth>
          <label className="flex items-center gap-2 text-sm text-ck-text">
            <input
              type="checkbox"
              name="isPublished"
              checked={values.isPublished}
              onChange={(e) => updateField("isPublished", e.target.checked)}
              className="size-4 rounded border-ck-border"
            />
            Publicada (visible en canal público)
          </label>
        </AdminFormFullWidth>

        <AdminFormFullWidth>
          <label className="flex items-center gap-2 text-sm text-ck-text">
            <input
              type="checkbox"
              name="registrationEnabled"
              checked={values.registrationEnabled}
              onChange={(e) => updateField("registrationEnabled", e.target.checked)}
              className="size-4 rounded border-ck-border"
            />
            Inscripciones habilitadas (gate de venta; requiere publicada y no borrador)
          </label>
          {state?.errors?.registrationEnabled ? (
            <p className="mt-2 text-sm text-[var(--ck-danger)]" role="alert">
              {state.errors.registrationEnabled}
            </p>
          ) : null}
        </AdminFormFullWidth>

        <AdminFormSection title="Ubicación">
          <Field id="location" label="Ubicación">
            <Input
              name="location"
              value={values.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="Argentina"
            />
          </Field>
          <Field id="city" label="Ciudad">
            <Input
              name="city"
              value={values.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </Field>
          <Field id="provinceOrState" label="Provincia / estado">
            <Input
              name="provinceOrState"
              value={values.provinceOrState}
              onChange={(e) => updateField("provinceOrState", e.target.value)}
            />
          </Field>
          <Field
            id="country"
            label="País"
            hint="Código de país, por ejemplo AR."
            error={state?.errors?.country}
          >
            <Input
              name="country"
              value={values.country}
              onChange={(e) => updateField("country", e.target.value)}
              placeholder="AR"
            />
          </Field>
        </AdminFormSection>

        <AdminFormSection title="Fechas">
          <Field id="startAt" label="Inicio" error={state?.errors?.startAt}>
            <Input
              type="datetime-local"
              name="startAt"
              value={values.startAt}
              onChange={(e) => updateField("startAt", e.target.value)}
            />
          </Field>
          <Field id="endAt" label="Fin" error={state?.errors?.endAt}>
            <Input
              type="datetime-local"
              name="endAt"
              value={values.endAt}
              onChange={(e) => updateField("endAt", e.target.value)}
            />
          </Field>
          <Field id="registrationOpenAt" label="Apertura inscripción" error={state?.errors?.registrationOpenAt}>
            <Input
              type="datetime-local"
              name="registrationOpenAt"
              value={values.registrationOpenAt}
              onChange={(e) => updateField("registrationOpenAt", e.target.value)}
            />
          </Field>
          <Field id="registrationCloseAt" label="Cierre inscripción" error={state?.errors?.registrationCloseAt}>
            <Input
              type="datetime-local"
              name="registrationCloseAt"
              value={values.registrationCloseAt}
              onChange={(e) => updateField("registrationCloseAt", e.target.value)}
            />
          </Field>
        </AdminFormSection>

        <AdminFormSection title="Capacidad e integraciones">
          <Field id="defaultCapacity" label="Capacidad por defecto" error={state?.errors?.defaultCapacity}>
            <Input
              name="defaultCapacity"
              inputMode="numeric"
              value={values.defaultCapacity}
              onChange={(e) => updateField("defaultCapacity", e.target.value)}
            />
          </Field>
          <Field
            id="fotorankContestId"
            label="ID concurso FotoRank"
            hint="Referencia opaca (cuid/slug). Sin FK."
            error={state?.errors?.fotorankContestId}
          >
            <Input
              name="fotorankContestId"
              value={values.fotorankContestId}
              onChange={(e) => updateField("fotorankContestId", e.target.value)}
            />
          </Field>
          <AdminFormFullWidth>
            <EditionCoverUploadFields
              editionId={editionId}
              horizontalUrl={values.coverImageUrl}
              verticalUrl={values.coverImageVerticalUrl}
              onHorizontalUrl={(url) => updateField("coverImageUrl", url)}
              onVerticalUrl={(url) => updateField("coverImageVerticalUrl", url)}
              horizontalError={state?.errors?.coverImageUrl}
              verticalError={state?.errors?.coverImageVerticalUrl}
            />
          </AdminFormFullWidth>
        </AdminFormSection>

        <AdminFormSection title="Contenido">
          <AdminFormFullWidth>
            <Field id="shortDescription" label="Descripción corta">
              <Textarea
                name="shortDescription"
                rows={2}
                value={values.shortDescription}
                onChange={(e) => updateField("shortDescription", e.target.value)}
              />
            </Field>
          </AdminFormFullWidth>
          <AdminFormFullWidth>
            <Field id="description" label="Descripción">
              <Textarea
                name="description"
                rows={5}
                value={values.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </Field>
          </AdminFormFullWidth>
        </AdminFormSection>
      </AdminForm>
    </form>
  );
}
