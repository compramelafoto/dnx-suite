import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { routes, marathonPath } from "@/config/navigation";
import { getPublicMarathonBySlug } from "@/data/public-marathons";
import { getPublicRegistrationContextAction } from "@/lib/public-registration/actions/public-registration";
import { buildPageMetadata } from "@/lib/seo";
import { GiftPurchaseForm } from "./GiftPurchaseForm";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const marathon = await getPublicMarathonBySlug(slug);
  return buildPageMetadata({
    title: marathon ? `Regalar — ${marathon.name}` : "Regalar una Clickatón",
    description: "Regalale a un amigo su lugar en la Clickatón.",
    path: `/maratones/${slug}/regalar`,
    image: marathon?.coverImage,
    imageAlt: marathon?.name,
    noIndex: true,
  });
}

export default async function GiftPurchasePage({ params }: PageProps) {
  const { slug } = await params;
  const contextResult = await getPublicRegistrationContextAction(slug);
  if (!contextResult.ok || !contextResult.data) notFound();

  const context = contextResult.data;
  // El módulo nace apagado por edición: si no está encendido, la ruta no existe.
  if (!context.edition.giftVouchersEnabled) notFound();

  const sellable = context.tickets.filter(
    (t) => !t.isSoldOut && t.salesStatus === "open" && !t.isMarathonPack,
  );
  if (context.registrationWindow !== "open" || sellable.length === 0) {
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <h1 className="ck-display-md">Todavía no se puede regalar</h1>
          <p role="status" className="text-ck-text-secondary">
            {context.registrationWindow === "not_open"
              ? "Las inscripciones todavía no están abiertas."
              : context.registrationWindow === "closed"
                ? "El período de inscripción finalizó."
                : "No hay entradas disponibles en este momento."}
          </p>
          <Button href={marathonPath(slug)} variant="secondary">
            Volver
          </Button>
        </Container>
      </Section>
    );
  }

  const idempotencyKey = `idem_${randomBytes(16).toString("hex")}`;

  return (
    <Section>
      <Container className="space-y-8 py-10 md:py-14">
        <SimpleBreadcrumb
          items={[
            { label: "Inicio", href: routes.home },
            { label: "Maratones", href: routes.marathons },
            { label: context.edition.name, href: marathonPath(slug) },
            { label: "Regalar" },
          ]}
        />
        <header className="space-y-3">
          <h1 className="ck-display-md">Regalale la Clickatón a un amigo</h1>
          <p className="max-w-2xl text-ck-text-secondary">
            Pagás vos, y tu amigo recibe un código para activar su lugar y cargar
            sus propios datos. Le podés mandar el voucher por email o por WhatsApp.
          </p>
        </header>
        <GiftPurchaseForm
          context={context}
          editionSlug={slug}
          idempotencyKey={idempotencyKey}
        />
      </Container>
    </Section>
  );
}
