import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { PublicRegistrationWizard } from "@/components/public-registration/PublicRegistrationWizard";
import { Button } from "@/components/ui/Button";
import { routes, marathonPath } from "@/config/navigation";
import { getPublicMarathonBySlug } from "@/data/public-marathons";
import { getPublicRegistrationContextAction } from "@/lib/public-registration/actions/public-registration";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "Inscripción",
    description: "Reservá tu lugar en Clickatón.",
    path: `/maratones/${slug}/inscripcion`,
    noIndex: true,
  });
}

export default async function PublicRegistrationPage({ params }: PageProps) {
  const { slug } = await params;
  const marathon = await getPublicMarathonBySlug(slug);
  const contextResult = await getPublicRegistrationContextAction(slug);

  if (!contextResult.ok || !contextResult.data) {
    if (contextResult.code === "EDITION_NOT_AVAILABLE") {
      return (
        <Section>
          <Container className="space-y-6 py-12">
            <h1 className="ck-display-md">Inscripción no disponible</h1>
            <p className="text-ck-text-secondary" role="status">
              {contextResult.message ??
                "Esta edición no admite inscripción pública en este momento."}
            </p>
            <Button href={marathon ? marathonPath(slug) : routes.marathons} variant="secondary">
              Volver
            </Button>
          </Container>
        </Section>
      );
    }
    if (!marathon) notFound();
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <h1 className="ck-display-md">No pudimos cargar el catálogo</h1>
          <p className="text-ck-text-secondary" role="alert">
            {contextResult.message ??
              "La inscripción nativa requiere una edición publicada en Clickatón con entradas configuradas."}
          </p>
          <Button href={marathonPath(slug)} variant="secondary">
            Volver a la maratón
          </Button>
        </Container>
      </Section>
    );
  }

  const context = contextResult.data;
  const idempotencyKey = `idem_${randomBytes(16).toString("hex")}`;

  if (context.registrationWindow !== "open" || context.tickets.every((t) => t.isSoldOut || t.salesStatus !== "open")) {
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <SimpleBreadcrumb
            items={[
              { label: "Inicio", href: routes.home },
              { label: "Maratones", href: routes.marathons },
              { label: context.edition.name, href: marathonPath(slug) },
              { label: "Inscripción" },
            ]}
          />
          <h1 className="ck-display-md">Inscripción no disponible</h1>
          <p role="status" className="text-ck-text-secondary">
            {context.registrationWindow === "not_open"
              ? "Las inscripciones todavía no estánieron."
              : context.registrationWindow === "closed"
                ? "El período de inscripción finalizó."
                : "No hay entradas vendibles en este momento."}
          </p>
          <Button href={marathonPath(slug)} variant="secondary">
            Volver
          </Button>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container className="space-y-8 py-10 md:py-14">
        <SimpleBreadcrumb
          items={[
            { label: "Inicio", href: routes.home },
            { label: "Maratones", href: routes.marathons },
            { label: context.edition.name, href: marathonPath(slug) },
            { label: "Inscripción" },
          ]}
        />
        <header className="space-y-3">
          <p className="ck-label text-ck-yellow">Inscripción pública</p>
          <h1 className="ck-display-md">{context.edition.name}</h1>
          <p className="max-w-2xl text-ck-text-secondary">
            Completá los pasos para reservar tu lugar. En entradas pagas, el cupo se
            reserva por un tiempo limitado hasta acreditar el pago.{" "}
            <span className="text-ck-text-muted">
              Entorno de prueba: no se realiza un cobro real.
            </span>
          </p>
        </header>
        <PublicRegistrationWizard context={context} idempotencyKey={idempotencyKey} />
      </Container>
    </Section>
  );
}
