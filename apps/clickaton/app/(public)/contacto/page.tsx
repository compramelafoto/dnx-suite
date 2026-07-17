import type { Metadata } from "next";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { contactPageContent } from "@/content/contact";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";

const content = contactPageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.contact,
});

export default function ContactPage() {
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
          <Card variant="outlined" className="border-dashed">
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

          <Card className="mt-12">
            <h2 className="ck-heading-lg">Formulario (próximamente)</h2>
            <p className="ck-body-sm mt-3 max-w-prose text-ck-text-muted">
              Vista previa del patrón de formularios V2. El envío permanece deshabilitado hasta
              publicar canales oficiales — sin backend en esta etapa.
            </p>
            <form className="mt-8 grid gap-6" aria-disabled="true">
              <Field
                id="contact-name"
                label="Nombre"
                hint="Como preferís que te nombremos."
                required
              >
                <Input
                  name="name"
                  placeholder="Tu nombre"
                  disabled
                  autoComplete="name"
                />
              </Field>
              <Field
                id="contact-email"
                label="Email"
                hint="Solo se usará para responder tu consulta."
                required
              >
                <Input
                  name="email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  disabled
                  autoComplete="email"
                />
              </Field>
              <Field id="contact-reason" label="Motivo" required>
                <Select name="reason" disabled defaultValue="">
                  <option value="" disabled>
                    Elegí un motivo
                  </option>
                  {content.reasons.map((reason) => (
                    <option key={reason.title} value={reason.title}>
                      {reason.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="contact-message"
                label="Mensaje"
                hint="Contanos el contexto en pocas líneas."
                required
              >
                <Textarea
                  name="message"
                  placeholder="Escribí tu mensaje…"
                  disabled
                  rows={5}
                />
              </Field>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="submit" disabled className="w-full sm:w-auto">
                  Enviar (próximamente)
                </Button>
                <p className="ck-caption text-ck-text-muted">
                  Estado: deshabilitado · sin envío de datos
                </p>
              </div>
            </form>
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
