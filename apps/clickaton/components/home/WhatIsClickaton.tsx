import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { homeContent } from "@/content/home";

export function WhatIsClickaton() {
  const { whatIs } = homeContent;

  return (
    <Section
      id={whatIs.id}
      className="relative overflow-hidden"
      aria-labelledby="what-is-title"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <Image
          src={whatIs.image.src}
          alt=""
          fill
          sizes="100vw"
          className="scale-105 object-cover object-[center_45%] grayscale opacity-[0.07] blur-[2px]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.72)_0%,rgb(17_17_17_/_0.82)_50%,rgb(17_17_17_/_0.9)_100%)]" />
      </div>

      <Container width="wide" className="relative z-[2]">
        <div className="max-w-4xl lg:max-w-5xl">
          <SectionHeader
            eyebrow={whatIs.eyebrow}
            title={whatIs.title}
            description={whatIs.lead}
            titleId="what-is-title"
            className="[&>div]:max-w-none"
          />
          <Stack gap="lg" className="mt-[var(--ck-stack-subtitle-to-content)]">
            {whatIs.paragraphs.map((paragraph) => (
              <p key={paragraph} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </Stack>
        </div>
      </Container>
    </Section>
  );
}
