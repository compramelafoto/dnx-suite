import { BrushStroke } from "@/components/brand/BrushStroke";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { homeContent } from "@/content/home";

export function Hero() {
  const { hero } = homeContent;

  return (
    <Section
      id={hero.id}
      tone="yellow"
      grain
      className="relative overflow-hidden border-b-2 border-ck-border-strong"
      aria-labelledby="hero-title"
    >
      <CoordinateGrid className="opacity-[0.07]" />
      <Container className="relative z-[2] max-w-3xl">
        <p className="ck-overline text-ck-black/70">{hero.eyebrow}</p>
        <h1
          id="hero-title"
          className="ck-display-xl mt-[var(--ck-stack-title-to-subtitle)] text-ck-black"
        >
          {hero.title}
        </h1>
        <p className="ck-accent-script mt-4 text-2xl text-ck-black md:text-3xl">
          {hero.tagline}
        </p>
        <BrushStroke className="mt-4" />
        <p className="ck-body-lg mt-[var(--ck-stack-subtitle-to-content)] max-w-prose text-ck-gray-700">
          {hero.description}
        </p>
        <div className="mt-[var(--ck-stack-content-to-actions)] flex flex-wrap gap-3">
          <Button href={hero.primaryCta.href}>{hero.primaryCta.label}</Button>
          <Button href={hero.secondaryCta.href} variant="outline">
            {hero.secondaryCta.label}
          </Button>
        </div>
        <p className="ck-caption mt-6 text-ck-gray-700">
          Mirar · crear · aprender · compartir
        </p>
      </Container>
    </Section>
  );
}
