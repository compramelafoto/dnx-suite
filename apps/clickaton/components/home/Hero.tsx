import { BrushStroke } from "@/components/brand/BrushStroke";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { homeContent } from "@/content/home";

export function Hero() {
  const { hero } = homeContent;

  return (
    <Section
      id={hero.id}
      tone="base"
      grain
      className="ck-vignette relative overflow-hidden border-b border-ck-border"
      aria-labelledby="hero-title"
    >
      <Container className="relative z-[2] py-8 sm:py-12 md:py-16 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="ck-overline text-ck-yellow">{hero.eyebrow}</p>
          <h1
            id="hero-title"
            className="ck-display-xl mt-[var(--ck-stack-title-to-subtitle)] mx-auto max-w-[16ch] break-words text-ck-text [overflow-wrap:anywhere]"
          >
            {hero.title}
          </h1>
          <p className="ck-accent-script mt-5 text-xl text-ck-text-secondary sm:mt-6 md:text-2xl">
            {hero.tagline}
          </p>
          <BrushStroke className="mx-auto mt-4 sm:mt-5" />
          <p className="ck-body-lg mx-auto mt-6 max-w-prose text-ck-text-secondary sm:mt-[var(--ck-stack-subtitle-to-content)]">
            {hero.description}
          </p>
          <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:mt-[var(--ck-stack-content-to-actions)] sm:flex-row sm:flex-wrap sm:items-center">
            <Button href={hero.primaryCta.href} className="w-full sm:w-auto">
              {hero.primaryCta.label}
            </Button>
            <Button
              href={hero.secondaryCta.href}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {hero.secondaryCta.label}
            </Button>
          </div>
          <p className="ck-caption mt-6 text-ck-text-muted sm:mt-8">
            Mirar · crear · aprender · compartir
          </p>
        </div>
      </Container>
    </Section>
  );
}
