import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { homeContent } from "@/content/home";

export function WhatIsClickaton() {
  const { whatIs } = homeContent;

  return (
    <Section id={whatIs.id} aria-labelledby="what-is-title">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="space-y-8">
          <SectionHeader
            eyebrow={whatIs.eyebrow}
            title={whatIs.title}
            description={whatIs.lead}
            titleId="what-is-title"
          />
          <Stack gap="lg">
            {whatIs.paragraphs.map((paragraph) => (
              <p key={paragraph} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </Stack>
        </div>
        <PhotoFrame
          variant="editorial"
          alt="Participantes explorando la ciudad con cámaras"
          overlay="soft"
          caption="Competencia, aprendizaje y comunidad en movimiento."
        />
      </Container>
    </Section>
  );
}
