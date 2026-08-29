import type { Metadata } from "next";
import { PROPOSAL_PIECES, defaultProposalPeriod, listSellableSpaces } from "@repo/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ProposalStudio } from "./ProposalStudio";
import { PROPOSAL_SELLER } from "@/lib/propuesta/seller";

/**
 * Pantalla interna para armar una propuesta comercial en el momento: un
 * vendedor sube el logo de una marca potencial y ve al instante cómo se
 * vería en las superficies publicitarias que ese vendedor puede ofrecer.
 *
 * No se publica: en producción responde 404, igual que `/demo-partners`.
 */

export const metadata: Metadata = {
  title: "Armar una propuesta · DNX Partners",
  description: "Mostrale a una marca cómo se vería su publicidad en las plataformas DNX.",
  robots: { index: false, follow: false },
};

export default function ProposalPage() {

  // Solo las piezas cuyo espacio este vendedor puede ofrecer. Lo declarado pero
  // todavía sin montar queda afuera: no se le promete a una marca un lugar
  // donde su logo nunca aparecería.
  const vendibles = new Set(
    listSellableSpaces(PROPOSAL_SELLER).map((space) => space.placementKey),
  );
  const pieces = PROPOSAL_PIECES.filter((p) => vendibles.has(p.placementKey));

  // Un mes desde hoy. El vendedor lo cambia; siempre queda como inicio y fin.
  const periodo = defaultProposalPeriod(new Date());
  const comoTexto = (d: Date) => d.toISOString().slice(0, 10);

  if (pieces.length === 0) {
    return (
      <Section aria-labelledby="propuesta-title">
        <Container>
          <SectionHeader
            eyebrow="DNX Partners"
            title="Todavía no hay espacios para ofrecer"
            description="Este vendedor no tiene ningún espacio publicitario montado. Cuando se monte al menos uno, la herramienta vuelve a estar disponible."
            titleId="propuesta-title"
          />
        </Container>
      </Section>
    );
  }

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
          defaultPeriod={{
            startsAt: comoTexto(periodo.startsAt),
            endsAt: comoTexto(periodo.endsAt),
          }}
          pieces={pieces.map((p) => ({
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
