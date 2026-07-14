import { BrushStroke } from "@/components/brand/BrushStroke";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { Logo } from "@/components/brand/Logo";
import { ViewfinderFrame } from "@/components/brand/ViewfinderFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { FocusMark } from "@/components/ui/FocusMark";
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
      <Container className="relative z-[2] grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
        <div className="max-w-2xl">
          <Logo
            variant="principal"
            href={null}
            height={96}
            className="mb-6 max-w-[12rem] sm:max-w-[14rem]"
          />
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
          <p className="ck-caption mt-6 flex items-center gap-2 text-ck-gray-700">
            <FocusMark size="sm" className="text-ck-black" />
            Mirar · crear · aprender · compartir
          </p>
        </div>

        <div className="relative justify-self-center lg:justify-self-end">
          <div className="absolute -left-1 -top-1 z-[1]">
            <Logo variant="isotipo" href={null} height={44} />
          </div>
          <ViewfinderFrame />
        </div>
      </Container>
    </Section>
  );
}
