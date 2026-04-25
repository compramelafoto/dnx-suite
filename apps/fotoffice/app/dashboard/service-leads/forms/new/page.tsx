import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { createServiceLeadForm } from "../actions";

export default async function NewServiceLeadFormPage() {
  const { workspace } = await requireActiveWorkspace();

  return (
    <div className="space-y-10">
      <PageHeader title="Nuevo formulario" description="Creá un formulario público de captación para este workspace." />

      {!workspace ? (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            No hay workspace activo para este usuario.
          </p>
        </div>
      ) : (
        <form action={createServiceLeadForm} className="fo-card space-y-6 max-w-2xl">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-name">
              Nombre
            </label>
            <input id="service-form-name" name="name" className="fo-input" required />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-slug">
              Slug
            </label>
            <input
              id="service-form-slug"
              name="slug"
              className="fo-input"
              placeholder="ej: xv"
              pattern="[a-z0-9-]+"
              required
            />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-event-type">
              Tipo de evento
            </label>
            <input id="service-form-event-type" name="eventType" className="fo-input" required />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="service-form-mode">
              Modo
            </label>
            <select id="service-form-mode" name="formMode" className="fo-input" defaultValue="SPECIFIC" required>
              <option value="SPECIFIC">SPECIFIC</option>
              <option value="GENERAL">GENERAL</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--fo-text)]">
              <input type="checkbox" name="isActive" className="h-4 w-4" defaultChecked />
              Activo
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--fo-text)]">
              <input type="checkbox" name="isDefault" className="h-4 w-4" />
              Por defecto
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="fo-btn fo-btn-primary">
              Crear formulario
            </button>
            <Link href="/dashboard/service-leads/forms" className="fo-btn fo-btn-secondary">
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
