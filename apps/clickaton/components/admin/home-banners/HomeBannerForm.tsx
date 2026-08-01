"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminForm, AdminFormFullWidth, AdminFormSection } from "@/components/admin/AdminForm";
import { EditionCoverUploadFields } from "@/components/admin/editions/EditionCoverUploadFields";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  HOME_BANNER_LINK_LABELS,
  HOME_BANNER_LINK_TYPES,
  emptyHomeBannerFormInput,
  type HomeBannerFormInput,
  type HomeBannerLinkType,
} from "@/lib/admin/home-banners/types";
import type { HomeBannerActionState } from "@/lib/admin/home-banners/mutations";
import {
  createHomeBannerAction,
  updateHomeBannerAction,
} from "@/lib/admin/home-banners/mutations";

type EditionOption = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
  bannerId?: string | null;
  initialValues?: HomeBannerFormInput;
  editions: EditionOption[];
  cancelHref: string;
};

export function HomeBannerForm({
  mode,
  bannerId = null,
  initialValues = emptyHomeBannerFormInput(),
  editions,
  cancelHref,
}: Props) {
  const router = useRouter();
  const action = mode === "edit" ? updateHomeBannerAction : createHomeBannerAction;
  const [state, formAction, pending] = useActionState(action, undefined as HomeBannerActionState | undefined);
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (!state?.ok) return;
    if (mode === "create") {
      router.push("/admin/banners-home");
      return;
    }
    router.refresh();
  }, [state, router, mode]);

  function updateField<K extends keyof HomeBannerFormInput>(key: K, value: HomeBannerFormInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="space-y-4">
      {bannerId ? <input type="hidden" name="bannerId" value={bannerId} /> : null}
      {state?.message && !state.ok ? (
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="rounded-[var(--ck-radius-card)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {state.message}
        </p>
      ) : null}

      <AdminForm
        title="Banner del Home"
        description="Definí imagen, texto y a dónde lleva el clic (maratón, página o link externo)."
        footer={
          <>
            <Button href={cancelHref} variant="secondary">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {mode === "edit" ? "Guardar cambios" : "Crear banner"}
            </Button>
          </>
        }
      >
        <Field id="title" label="Título" required error={state?.errors?.title}>
          <Input
            name="title"
            value={values.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
        </Field>
        <Field id="eyebrow" label="Eyebrow / etiqueta" error={state?.errors?.eyebrow}>
          <Input
            name="eyebrow"
            value={values.eyebrow}
            onChange={(e) => updateField("eyebrow", e.target.value)}
            placeholder="Próxima · Rosario"
          />
        </Field>
        <AdminFormFullWidth>
          <Field id="description" label="Descripción">
            <Textarea
              name="description"
              rows={3}
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </Field>
        </AdminFormFullWidth>
        <Field id="ctaLabel" label="Texto del botón" required error={state?.errors?.ctaLabel}>
          <Input
            name="ctaLabel"
            value={values.ctaLabel}
            onChange={(e) => updateField("ctaLabel", e.target.value)}
          />
        </Field>
        <Field id="sortOrder" label="Orden" hint="Menor número aparece primero." error={state?.errors?.sortOrder}>
          <Input
            name="sortOrder"
            inputMode="numeric"
            value={values.sortOrder}
            onChange={(e) => updateField("sortOrder", e.target.value)}
          />
        </Field>

        <AdminFormSection title="Destino del clic">
          <Field id="linkType" label="Tipo de destino" error={state?.errors?.linkType}>
            <Select
              name="linkType"
              value={values.linkType}
              onChange={(e) => updateField("linkType", e.target.value as HomeBannerLinkType)}
            >
              {HOME_BANNER_LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {HOME_BANNER_LINK_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>

          {values.linkType === "EDITION" ? (
            <Field id="editionId" label="Edición" required error={state?.errors?.editionId}>
              <Select
                name="editionId"
                value={values.editionId}
                onChange={(e) => updateField("editionId", e.target.value)}
              >
                <option value="">Elegí una edición…</option>
                {editions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {ed.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field
              id="href"
              label={values.linkType === "INTERNAL" ? "Ruta interna" : "URL externa"}
              required
              hint={
                values.linkType === "INTERNAL"
                  ? "Ej. /comunidad, /organizar, /como-funciona, /#faq o un artículo del sitio"
                  : "Ej. https://… (WhatsApp, artículo externo, etc.)"
              }
              error={state?.errors?.href}
            >
              <Input
                name="href"
                value={values.href}
                onChange={(e) => updateField("href", e.target.value)}
              />
            </Field>
          )}
        </AdminFormSection>

        <AdminFormSection title="Imágenes">
          <AdminFormFullWidth>
            <EditionCoverUploadFields
              horizontalUrl={values.imageUrl}
              verticalUrl={values.imageUrlVertical}
              onHorizontalUrl={(url) => updateField("imageUrl", url)}
              onVerticalUrl={(url) => updateField("imageUrlVertical", url)}
              horizontalError={state?.errors?.imageUrl}
              verticalError={state?.errors?.imageUrlVertical}
            />
          </AdminFormFullWidth>
        </AdminFormSection>

        <AdminFormFullWidth>
          <label className="flex items-center gap-3 text-sm text-ck-text">
            <input
              type="checkbox"
              name="isActive"
              value="on"
              checked={values.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="size-4 accent-[var(--ck-yellow)]"
            />
            Activo (visible en el Home)
          </label>
        </AdminFormFullWidth>
      </AdminForm>
    </form>
  );
}
