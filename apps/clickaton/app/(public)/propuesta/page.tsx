import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROPOSAL_PIECES } from "@repo/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ProposalStudio } from "./ProposalStudio";

/**
 * Pantalla interna para armar una propuesta comercial en el momento: un
 * vendedor sube el logo de una marca potencial y ve al instante cómo se
 * vería en las nueve superficies publicitarias de las cuatro plataformas.
 *
 * No se publica: en producción responde 404, igual que `/demo-partners`.
 */

export const metadata: Metadata = {
  title: "Armar una propuesta · DNX Partners",
  description: "Mostrale a una marca cómo se vería su publicidad en las plataformas DNX.",
  robots: { index: false, follow: false },
};

export default function ProposalPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Section aria-labelledby="propuesta-title">
      <Container>
        <SectionHeader
          eyebrow="DNX Partners"
          title="Armá una propuesta en un minuto"
          description="Subí el logo del cliente y mirá cómo se vería su marca en las pantallas reales de las cuatro plataformas."
          titleId="propuesta-title"
        />
        <ProposalStudio
          pieces={PROPOSAL_PIECES.map((p) => ({
            id: p.id,
            label: p.label,
            platformLabel: p.platformLabel,
            location: p.location,
          }))}
        />
      </Container>
    </Section>
  );
}
