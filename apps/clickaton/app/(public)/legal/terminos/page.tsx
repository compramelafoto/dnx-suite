import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Términos y condiciones",
  description: "Bases y condiciones generales de participación en Clickatón.",
  path: "/legal/terminos",
  noIndex: true,
});

export default function TermsPage() {
  return (
    <Section>
      <Container className="prose prose-invert max-w-3xl space-y-6 py-12">
        <h1>Términos y condiciones</h1>
        <p>
          Al inscribirte en una edición de Clickatón aceptás las bases específicas de
          esa edición y estas condiciones generales de participación.
        </p>
        <p>
          La reserva de cupo durante el flujo de inscripción es temporal y no implica
          confirmación hasta completar el pago o la validación correspondiente.
        </p>
        <p>
          Clickatón podrá actualizar estas condiciones. La versión aplicable es la
          publicada al momento de aceptar el consentimiento en el formulario.
        </p>
      </Container>
    </Section>
  );
}
