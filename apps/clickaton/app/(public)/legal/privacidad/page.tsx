import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Política de privacidad",
  description: "Cómo Clickatón trata los datos personales de inscripción.",
  path: "/legal/privacidad",
  noIndex: true,
});

export default function PrivacyPage() {
  return (
    <Section>
      <Container className="prose prose-invert max-w-3xl space-y-6 py-12">
        <h1>Política de privacidad</h1>
        <p>
          Los datos que completás en la inscripción (identidad de contacto, documento
          cuando corresponda y datos de participación) se usan para gestionar tu
          reserva, comunicación operativa y acreditación futura.
        </p>
        <p>
          No compartimos tus datos con terceros para marketing sin tu consentimiento.
          Los proveedores de pago se incorporarán en etapas posteriores con sus propias
          políticas.
        </p>
        <p>
          Podés solicitar acceso o corrección de tus datos escribiendo a los canales
          oficiales de contacto de Clickatón.
        </p>
      </Container>
    </Section>
  );
}
