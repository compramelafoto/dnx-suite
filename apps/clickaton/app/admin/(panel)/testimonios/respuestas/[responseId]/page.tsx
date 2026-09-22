import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TestimonialModerationPanel } from "@/components/admin/testimonials/TestimonialModerationPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { fechaHoraLargaAr } from "@/lib/fecha-ar";
import { loadResponseDetail } from "@/lib/testimonials/admin/list-responses";
import { buildExcerpt } from "@/lib/testimonials/domain/excerpt";
import {
  NPS_QUESTION,
  SURVEY_ASPECTS,
  WOULD_RETURN_OPTIONS,
} from "@/lib/testimonials/domain/survey-definition";
import { authorRoleLabel } from "@/lib/testimonials/public/voices-presentation";
import { presentTestimonialStatus } from "@/lib/testimonials/ui/testimonial-status-presentation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ responseId: string }> };

export default async function AdminTestimonialResponseDetailPage({
  params,
}: PageProps) {
  await requireClickatonAdmin();
  const { responseId } = await params;
  const response = await loadResponseDetail(responseId);
  if (!response) notFound();

  const testimonial = response.testimonial;
  const presentation = presentTestimonialStatus(
    testimonial?.status ?? null,
    testimonial?.publicationConsent ?? false,
  );
  const wouldReturnLabel =
    WOULD_RETURN_OPTIONS.find((o) => o.value === response.wouldReturn)?.label ??
    "No contestó";

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={testimonial?.authorName ?? "Respuesta de la encuesta"}
        description={`${authorRoleLabel(response.authorRole)} · ${response.edition.name} · ${fechaHoraLargaAr(response.submittedAt)}`}
        breadcrumbs={[
          { label: "Testimonios y calidad", href: adminRoutes.testimonials },
          { label: "Respuestas", href: `${adminRoutes.testimonials}/respuestas` },
          { label: testimonial?.authorName ?? "Respuesta" },
        ]}
        actions={<Badge variant={presentation.tone}>{presentation.label}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-ck-text">Los números</h2>
          <div className="space-y-2">
            <p className="text-sm text-ck-text-secondary">{NPS_QUESTION}</p>
            <p className="font-[family-name:var(--font-ck-display)] text-4xl text-ck-text">
              {response.npsScore}
              <span className="text-lg text-ck-text-muted"> / 10</span>
            </p>
          </div>
          <ul className="divide-y divide-ck-border">
            {SURVEY_ASPECTS.map((aspect) => {
              const value = response[aspect.field];
              return (
                <li
                  key={aspect.field}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm text-ck-text">{aspect.label}</span>
                  <span className="text-sm text-ck-text-secondary">
                    {value === null ? "No aplica" : `${value} / 5`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-ck-text-secondary">
            ¿Volvería a participar? <strong>{wouldReturnLabel}</strong>
          </p>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ck-text">
              Lo que escribió para publicar
            </h2>
            {testimonial ? (
              <blockquote className="text-base leading-relaxed text-ck-text">
                «{testimonial.quote}»
              </blockquote>
            ) : (
              <p className="text-sm text-ck-text-muted">
                No dejó testimonio, o no autorizó publicarlo.
              </p>
            )}
            {testimonial?.authorLinkUrl ? (
              <p className="text-sm text-ck-text-secondary">
                Enlace del autor:{" "}
                <span className="break-all">{testimonial.authorLinkUrl}</span>
              </p>
            ) : null}
          </Card>

          <Card className="space-y-3 border-t-2 border-t-[var(--ck-warning)]">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ck-text">
                Qué mejoraría
              </h2>
              <Badge variant="warning">Privado — no se publica</Badge>
            </div>
            {response.improvementNotes?.trim() ? (
              <p className="whitespace-pre-line text-base leading-relaxed text-ck-text">
                {response.improvementNotes}
              </p>
            ) : (
              <p className="text-sm text-ck-text-muted">No escribió nada acá.</p>
            )}
          </Card>
        </div>
      </div>

      {testimonial ? (
        <TestimonialModerationPanel
          testimonialId={testimonial.id}
          status={testimonial.status}
          publicationConsent={testimonial.publicationConsent}
          defaultExcerpt={
            testimonial.highlightedExcerpt ?? buildExcerpt(testimonial.quote)
          }
        />
      ) : (
        <Card>
          <p className="text-sm text-ck-text-secondary">
            No hay nada que moderar: esta respuesta suma a las métricas y no
            tiene testimonio publicable.
          </p>
        </Card>
      )}
    </div>
  );
}
