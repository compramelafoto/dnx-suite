"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  updateCoursesSalesSettingsAction,
  type SettingsFormState,
} from "@/app/actions/settings";

const initial: SettingsFormState = { error: null };

type CoursesSettingsInitial = {
  defaultCurrency: string;
  enrollmentCtaLabel: string | null;
  coursesFeePercent: string;
};

export function ModuleSettingsForm({ initialValues }: { initialValues: CoursesSettingsInitial }) {
  const [state, action, pending] = useActionState(updateCoursesSalesSettingsAction, initial);

  return (
    <form action={action} className="fo-section-gap max-w-3xl">
      <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
        Nombre, slug público, logo, portada y datos de contacto se editan en{" "}
        <Link href="/workspace/configuracion" className="text-[var(--fo-accent)] hover:underline">
          Configuración
        </Link>{" "}
        — son del workspace, no de este módulo.
      </p>

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
