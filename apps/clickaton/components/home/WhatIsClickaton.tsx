import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { homeContent } from "@/content/home";

export function WhatIsClickaton() {
  const { whatIs } = homeContent;

  return (
    <Section id={whatIs.id} aria-labelledby="what-is-title">
      <Container className="mx-auto max-w-3xl text-center">
        <SectionHeader
          align="center"
          eyebrow={whatIs.eyebrow}
          title={whatIs.title}
          description={whatIs.lead}
          titleId="what-is-title"
        />
        <Stack gap="lg" className="mt-8">
          {whatIs.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="ck-body-lg mx-auto max-w-prose text-ck-text-secondary"
            >
              {paragraph}
            </p>
          ))}
        </Stack>
      </Container>
    </Section>
  );
}
