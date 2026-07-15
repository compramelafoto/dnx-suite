import { BrushStroke } from "@/components/brand/BrushStroke";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { PhotoFrame } from "@/components/content/PhotoFrame";
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
      <CoordinateGrid className="opacity-[0.04]" />
      <Container className="relative z-[2] grid items-center gap-10 py-6 sm:py-10 md:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-20">
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{hero.eyebrow}</p>
          <h1
            id="hero-title"
            className="ck-display-xl mt-[var(--ck-stack-title-to-subtitle)] max-w-[16ch] break-words text-ck-text [overflow-wrap:anywhere]"
          >
            {hero.title}
          </h1>
          <p className="ck-accent-script mt-5 text-xl text-ck-text-secondary sm:mt-6 md:text-2xl">
            {hero.tagline}
          </p>
          <BrushStroke className="mt-4 sm:mt-5" />
          <p className="ck-body-lg mt-6 max-w-prose text-ck-text-secondary sm:mt-[var(--ck-stack-subtitle-to-content)]">
            {hero.description}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:mt-[var(--ck-stack-content-to-actions)] sm:w-auto sm:flex-row sm:flex-wrap">
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

        <PhotoFrame
          variant="hero"
          alt="Escena urbana de maratón fotográfica"
          overlay="medium"
          eyebrow="Encuadre"
          caption="La ciudad como escenario."
          className="shadow-[var(--ck-photo-shadow)] lg:justify-self-end lg:max-w-md"
          priority
        />
      </Container>
    </Section>
  );
}
