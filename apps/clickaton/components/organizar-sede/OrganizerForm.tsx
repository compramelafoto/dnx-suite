import { ContactForm } from "@/components/contact/ContactForm";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { organizarSedeContent } from "@/content/organizar-sede";

const { form } = organizarSedeContent;

/**
 * Reutiliza el ContactForm institucional con motivo “organizar”.
 * Misma integración que /contacto?motivo=organizar.
 */
export function OrganizerForm() {
  return (
    <Section
      tone="raised"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-form-title"
      id="formulario"
    >
      <Container className="max-w-3xl">
        <p className="ck-overline text-ck-yellow">{form.eyebrow}</p>
        <h2 id="organizer-form-title" className="ck-display-lg mt-6 text-ck-text">
          {form.title}
        </h2>
        <p className="ck-body-lg mt-8 text-ck-text-secondary">{form.lead}</p>

        <Card className="mt-12" variant="outlined">
          <p className="ck-body-sm text-ck-text-muted">{form.note}</p>
          <div className="mt-8">
            <ContactForm defaultReason="organizar" source="organizar" />
          </div>
        </Card>
      </Container>
    </Section>
  );
}
