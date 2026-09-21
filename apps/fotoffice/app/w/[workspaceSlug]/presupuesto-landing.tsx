import { PublicDynamicServiceLeadForm } from "./public-dynamic-service-lead-form";

type ServiceLeadFormData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  configJson: unknown;
};

type Props = {
  workspaceSlug: string;
  commercialName: string;
  form: ServiceLeadFormData | null;
};

/**
 * La landing de presupuesto de siempre: la que está en producción hoy y la que la gente ya
 * comparte por WhatsApp. Se usa como respaldo cuando el workspace no tiene sitio publicado —
 * porque el módulo Sitio web está apagado, o porque nunca publicó.
 *
 * Es el `<main>` que antes vivía en `page.tsx`, movido tal cual: el encabezado y los botones de
 * navegación ya no van acá, porque ahora los pone el armazón (`app/w/[workspaceSlug]/layout.tsx`).
 */
export function PresupuestoLanding({ workspaceSlug, commercialName, form }: Props) {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <section className="fo-card border-[var(--fo-accent)]/30 bg-[var(--fo-bg-elevated)] space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
            {commercialName}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-balance">
            {form?.title ?? "Solicitá tu presupuesto"}
          </h1>
          <p className="text-[var(--fo-muted)] leading-relaxed max-w-2xl">
            {form?.description ??
              "Elegí el tipo de servicio que necesitás y completá tus datos para recibir una propuesta."}
          </p>
        </div>

        {!form ? (
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">No hay formulario disponible.</p>
        ) : (
          <PublicDynamicServiceLeadForm workspaceSlug={workspaceSlug} form={form} />
        )}
      </section>
    </main>
  );
}
