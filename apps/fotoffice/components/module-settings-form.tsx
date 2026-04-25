"use client";

import { useActionState } from "react";
import {
  updateCoursesSalesSettingsAction,
  type SettingsFormState,
} from "@/app/actions/settings";

const initial: SettingsFormState = { error: null };

type BrandingInitial = {
  publicSlug: string;
  commercialName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  contactEmail: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  defaultCurrency: string;
  enrollmentCtaLabel: string | null;
  coursesFeePercent: string;
};

export function ModuleSettingsForm({ initialValues }: { initialValues: BrandingInitial }) {
  const [state, action, pending] = useActionState(updateCoursesSalesSettingsAction, initial);

  return (
    <form action={action} className="fo-section-gap max-w-3xl">
      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Marca pública</h2>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            Estos datos aparecen en las landings de tus cursos bajo{" "}
            <code className="text-xs bg-[var(--fo-bg)] px-1 rounded">/w/[slug]/cursos/…</code>.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="commercialName">
            Nombre comercial
          </label>
          <input
            id="commercialName"
            name="commercialName"
            required
            defaultValue={initialValues.commercialName}
            className="fo-input"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="publicSlug">
            Slug público del workspace
          </label>
          <input
            id="publicSlug"
            name="publicSlug"
            required
            defaultValue={initialValues.publicSlug}
            className="fo-input font-mono text-sm"
          />
          <p className="fo-helper">Único en toda la plataforma. Solo minúsculas, números y guiones.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="logoUrl">
              Logo (URL)
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={initialValues.logoUrl ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="coverImageUrl">
              Imagen de portada marca (URL)
            </label>
            <input
              id="coverImageUrl"
              name="coverImageUrl"
              type="url"
              defaultValue={initialValues.coverImageUrl ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Contacto</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="contactEmail">
              Email de contacto
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={initialValues.contactEmail ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="phone">
              Teléfono
            </label>
            <input id="phone" name="phone" defaultValue={initialValues.phone ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="whatsapp">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              defaultValue={initialValues.whatsapp ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="instagram">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              defaultValue={initialValues.instagram ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack sm:col-span-2">
            <label className="fo-label" htmlFor="website">
              Sitio web
            </label>
            <input
              id="website"
              name="website"
              defaultValue={initialValues.website ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Ventas</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="defaultCurrency">
              Moneda por defecto
            </label>
            <input
              id="defaultCurrency"
              name="defaultCurrency"
              defaultValue={initialValues.defaultCurrency}
              className="fo-input"
            />
            <p className="fo-helper">Código ISO (ej. ARS, USD). Los precios del curso pueden usar otra.</p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="enrollmentCtaLabel">
              Texto del botón de inscripción
            </label>
            <input
              id="enrollmentCtaLabel"
              name="enrollmentCtaLabel"
              defaultValue={initialValues.enrollmentCtaLabel ?? "Quiero inscribirme"}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="coursesFeePercent">
              Fee cursos presenciales (%)
            </label>
            <input
              id="coursesFeePercent"
              name="coursesFeePercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={initialValues.coursesFeePercent}
              className="fo-input"
            />
            <p className="fo-helper">Mínimo 0, máximo 100. Se descuenta solo en pagos aprobados.</p>
          </div>
        </div>
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          Configuración guardada.
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}
