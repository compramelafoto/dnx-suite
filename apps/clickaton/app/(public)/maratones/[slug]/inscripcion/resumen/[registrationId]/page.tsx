import type { Metadata } from "next";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { routes, marathonPath } from "@/config/navigation";
import { getPublicRegistrationSummaryAction } from "@/lib/public-registration/actions/public-registration";
import { formatHoldExpiry, formatPublicPrice } from "@/lib/public-registration/ui/format";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string; registrationId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "Resumen de inscripción",
    description: "Reserva temporal de inscripción Clickatón.",
    path: `/maratones/${slug}/inscripcion/resumen`,
    noIndex: true,
  });
}

export default async function PublicRegistrationSummaryPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, registrationId } = await params;
  const { t } = await searchParams;
  const result = await getPublicRegistrationSummaryAction(
    registrationId,
    t ?? "",
    slug,
  );

  if (!result.ok || !result.data) {
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <h1 className="ck-display-md">Resumen no disponible</h1>
          <p className="text-ck-text-secondary" role="alert">
            {result.code === "TOKEN_INVALID" ||
            result.code === "TOKEN_EXPIRED" ||
            result.code === "FORBIDDEN"
              ? "Este enlace de resumen no es válido o expiró. Si acabás de inscribirte, usá el enlace completo que recibiste al finalizar."
              : (result.message ?? "No se pudo mostrar el resumen.")}
          </p>
          <Button href={marathonPath(slug)} variant="secondary">
            Volver a la maratón
          </Button>
        </Container>
      </Section>
    );
  }

  const s = result.data;

  return (
    <Section>
      <Container className="space-y-8 py-10 md:py-14">
        <SimpleBreadcrumb
          items={[
            { label: "Inicio", href: routes.home },
            { label: "Maratones", href: routes.marathons },
            { label: s.editionName, href: marathonPath(slug) },
            { label: "Resumen" },
          ]}
        />
        <header className="space-y-3">
          <p className="ck-label text-ck-yellow">Reserva creada</p>
          <h1 className="ck-display-md">Tu inscripción quedó reservada</h1>
          <p className="max-w-2xl text-ck-text-secondary" role="status">
            Estado: {s.status.replaceAll("_", " ")} · Cobro:{" "}
            {s.paymentStatus.replaceAll("_", " ")}
            {s.isExpired ? " · Reserva vencida" : ""}.
            {!s.isExpired
              ? " Todavía no hay pago realizado ni confirmación definitiva."
              : " El cupo puede haber sido liberado."}
          </p>
        </header>

        <div className="grid gap-6 rounded-[var(--ck-radius-card)] border border-ck-border p-6 md:grid-cols-2">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ck-text-secondary">Referencia</dt>
              <dd className="font-mono">{s.publicCode ?? s.registrationId.slice(0, 12)}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Edición</dt>
              <dd>{s.editionName}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Sede</dt>
              <dd>{s.venueName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Entrada</dt>
              <dd>{s.ticketName}</dd>
            </div>
          </dl>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ck-text-secondary">Participante</dt>
              <dd>
                {s.participant.firstName} {s.participant.lastNameInitial}
              </dd>
              <dd className="text-ck-text-muted">{s.participant.emailMasked}</dd>
              <dd className="text-ck-text-muted">Tel. {s.participant.phoneMasked}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Importe</dt>
              <dd className="text-lg font-semibold">
                {formatPublicPrice(s.totalAmount, s.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Vence la reserva</dt>
              <dd>{formatHoldExpiry(s.holdExpiresAt)}</dd>
            </div>
          </dl>
        </div>

        {s.items.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold">Productos incluidos</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {s.items.map((item, idx) => (
                <li key={`${item.nameSnapshot}-${idx}`}>
                  {item.quantity}× {item.nameSnapshot}
                  {item.skuSnapshot ? ` (${item.skuSnapshot})` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="rounded border border-ck-border bg-ck-surface p-5">
          <p className="font-semibold">{s.nextStepMessage}</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            {s.checkoutEligible
              ? "No hay botón de pago activo en esta etapa. La reserva sigue vigente hasta el vencimiento."
              : "No podés continuar al checkout con esta inscripción en su estado actual."}
          </p>
        </div>

        <Button href={marathonPath(slug)} variant="secondary">
          Volver a la maratón
        </Button>
      </Container>
    </Section>
  );
}
