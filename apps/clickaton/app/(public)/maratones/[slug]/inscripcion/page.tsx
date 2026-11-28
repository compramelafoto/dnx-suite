import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import {
  DecoradoEstacional,
  type MotivoEstacional,
} from "@/components/public-registration/experience/decorado-estacional";
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

/**
 * Ediciones que se visten para la ocasión. Lista explícita a propósito: mirar
 * el slug con una expresión regular haría que cualquier edición futura con la
 * palabra "navidad" u "otoño" se decorara sola, sin que nadie lo decidiera.
 */
const MOTIVO_POR_EDICION: Record<string, MotivoEstacional> = {
  "clickaton-navidad-2026": "navidad",
  "clickaton-otono-2027": "otono",
};

/**
 * Nota al pie del título, para lo que la fecha sola no explica. La del 26 de
 * diciembre sale al cruce de la objeción obvia —cae entre fiestas— en lugar de
 * esperar que cada uno la resuelva solo y se vaya.
 */
const NOTAS_POR_EDICION: Record<string, string> = {
  "clickaton-navidad-2026":
    "Sabemos que el 26 algunos van a estar todavía con la copa en la mano y otros de viaje por el fin de semana largo. Pero, ¿qué mejor regalo que salir a registrar esos momentos y maratonear con Clickatón?",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const marathon = await getPublicMarathonBySlug(slug);
  return buildPageMetadata({
    title: marathon ? `Inscripción — ${marathon.name}` : "Inscripción",
    description: marathon?.shortDescription?.trim()
      ? marathon.shortDescription
      : "Reservá tu lugar en Clickatón.",
    path: `/maratones/${slug}/inscripcion`,
    image: marathon?.coverImage,
    imageAlt: marathon?.name,
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
  const motivo = MOTIVO_POR_EDICION[slug];

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
              ? "Las inscripciones todavía no están abiertas."
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
        <header className="sr-only">
          <h1>Inscripción — {context.edition.name}</h1>
        </header>
        {motivo ? (
          <DecoradoEstacional motivo={motivo}>
            <PublicRegistrationWizard
              context={context}
              idempotencyKey={idempotencyKey}
              coverImageUrl={marathon?.coverImage ?? null}
              nota={NOTAS_POR_EDICION[slug] ?? null}
            />
          </DecoradoEstacional>
        ) : (
          <PublicRegistrationWizard
            context={context}
            idempotencyKey={idempotencyKey}
            coverImageUrl={marathon?.coverImage ?? null}
            nota={NOTAS_POR_EDICION[slug] ?? null}
          />
        )}
      </Container>
    </Section>
  );
}
