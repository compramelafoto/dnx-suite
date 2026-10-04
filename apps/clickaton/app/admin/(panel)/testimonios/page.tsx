import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { InviteTestimonialsButton } from "@/components/admin/testimonials/InviteTestimonialsButton";
import { SurveyShareLinks } from "@/components/admin/testimonials/SurveyShareLinks";
import { TestimonialModuleSettingsForm } from "@/components/admin/testimonials/TestimonialModuleSettingsForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import { loadTestimonialDashboard } from "@/lib/testimonials/admin/load-dashboard";
import { surveyUrl } from "@/lib/testimonials/public/survey-share";
import { npsToneLabel } from "@/lib/testimonials/ui/testimonial-status-presentation";

export const dynamic = "force-dynamic";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="space-y-1">
      <p className="text-xs uppercase tracking-[0.08em] text-ck-text-muted">{label}</p>
      <p className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text">
        {value}
      </p>
      {hint ? <p className="text-sm text-ck-text-secondary">{hint}</p> : null}
    </Card>
  );
}

export default async function AdminTestimonialsPage() {
  await requireClickatonAdmin();
  const dashboard = await loadTestimonialDashboard();
  const publicOrigin = resolveClickatonPublicOrigin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Testimonios y calidad"
        description="Qué le pareció Clickatón a quienes estuvieron, con números comparables entre ediciones, y qué testimonios salen publicados."
        breadcrumbs={[{ label: "Testimonios y calidad" }]}
        actions={
          <Button
            href={`${adminRoutes.testimonials}/respuestas`}
            variant="primary"
            className="min-h-11"
          >
            Ver todas las respuestas
          </Button>
        }
      />

      <Card className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ck-text">
            Encuesta por edición
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Encender la encuesta abre el formulario para quienes participaron y
            habilita la invitación por correo. Los días cuentan desde el cierre
            de la edición.
          </p>
        </div>
        {dashboard.allEditions.map((edition) => (
          <div key={edition.id} className="space-y-3">
            <TestimonialModuleSettingsForm
              editionId={edition.id}
              editionName={edition.name}
              enabled={edition.testimonialsEnabled}
              delayDays={edition.testimonialInviteDelayDays}
            />
            {edition.testimonialsEnabled ? (
              <SurveyShareLinks
                editionName={edition.name}
                url={surveyUrl(publicOrigin, edition.slug)}
              />
            ) : null}
          </div>
        ))}
      </Card>

      {dashboard.enabledEditions.length > 0 ? (
        <Card className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ck-text">
              Invitar a testimoniar
            </h2>
            <p className="text-sm text-ck-text-secondary">
              El correo sale solo unos días después de cada edición. Este botón
              sirve para adelantarlo o para cubrir a quien no lo recibió: nadie
              recibe dos veces la misma invitación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dashboard.enabledEditions.map((edition) => (
              <InviteTestimonialsButton
                key={edition.id}
                editionId={edition.id}
                editionName={edition.name}
              />
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ck-text-secondary">
            Ninguna edición tiene la encuesta encendida. Se activa acá arriba,
            en «Encuesta por edición». Tené en cuenta que si el plazo de esa
            edición ya venció, encenderla manda las invitaciones dentro de la
            hora.
          </p>
        </Card>
      )}

      {dashboard.editions.length === 0 ? (
        <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-8 text-center text-sm text-ck-text-muted">
          Todavía no hay respuestas ni invitaciones.
        </p>
      ) : null}

      {dashboard.editions.map((edition) => (
        <section key={edition.editionId} className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-text">
              {edition.editionName}
            </h2>
            <p className="text-sm text-ck-text-muted">
              {edition.responses} respuesta{edition.responses === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="NPS"
              value={String(edition.nps.score)}
              hint={`${npsToneLabel(edition.nps.score)} · ${edition.nps.promoters} promotores, ${edition.nps.passives} pasivos, ${edition.nps.detractors} detractores`}
            />
            <Metric
              label="Volvería a participar"
              value={`${edition.wouldReturn.positiveRate}%`}
              hint={`${edition.wouldReturn.yes} sí · ${edition.wouldReturn.maybe} tal vez · ${edition.wouldReturn.no} no`}
            />
            <Metric
              label="Tasa de respuesta"
              value={`${edition.responseRate}%`}
              hint={`${edition.responded} de ${edition.invited} invitados`}
            />
            <Metric
              label="Testimonios"
              value={String(edition.testimonials.published)}
              hint={`publicados · ${edition.testimonials.pending} pendientes · ${edition.testimonials.rejected} rechazados`}
            />
          </div>

          <Card className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
              La relación de calidad
            </h3>
            <ul className="divide-y divide-ck-border">
              {edition.aspects.map((aspect) => (
                <li
                  key={aspect.field}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="text-sm text-ck-text">{aspect.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm text-ck-text-muted">
                      {aspect.answered} respuesta
                      {aspect.answered === 1 ? "" : "s"}
                      {aspect.notApplicable > 0
                        ? ` · ${aspect.notApplicable} «no aplica»`
                        : ""}
                    </span>
                    {aspect.average === null ? (
                      <Badge>Sin datos</Badge>
                    ) : (
                      <span className="font-[family-name:var(--font-ck-display)] text-xl text-ck-text">
                        {aspect.average.toFixed(1)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
