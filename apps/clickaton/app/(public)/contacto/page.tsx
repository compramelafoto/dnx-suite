import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { contactPageContent } from "@/content/contact";
import { routes } from "@/config/navigation";
import { resolveContactReason } from "@/lib/contact/reasons";
import { buildPageMetadata } from "@/lib/seo";

const content = contactPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.contact,
});

type Props = {
  searchParams?: Promise<{ motivo?: string; source?: string }>;
};

export default async function ContactPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const defaultReason = resolveContactReason(params.motivo);
  const source =
    params.source?.trim() ||
    (params.motivo === "formar-parte" ? "formar-parte" : "contacto");

  return (
    <>
      <SimpleBreadcrumb current="Contacto" />
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
      />

      <Section tone="raised">
        <Container className="max-w-3xl">
          <Card variant="outlined">
            <p className="ck-heading-md">{content.status}</p>
            <p className="ck-body-sm mt-3 text-ck-text-muted">{content.note}</p>
          </Card>

          <h2 className="ck-heading-lg mt-12">Motivos de contacto</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {content.reasons.map((reason) => (
              <li key={reason.title}>
                <Card className="h-full">
                  <h3 className="ck-heading-md">{reason.title}</h3>
                  <p className="ck-body-sm mt-3 text-ck-text-secondary">{reason.body}</p>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="mt-12" id="formulario">
            <h2 className="ck-heading-lg">Formulario</h2>
            <p className="ck-body-sm mt-3 max-w-prose text-ck-text-muted">
              Nombre, email y mensaje son obligatorios. Si venís desde Formá parte, el motivo
              ya queda preseleccionado.
            </p>
            <div className="mt-8">
              <ContactForm defaultReason={defaultReason} source={source} />
            </div>
          </Card>

          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            {content.links.map((link) => (
              <Button
                key={link.href}
                href={link.href}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {link.label}
              </Button>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
