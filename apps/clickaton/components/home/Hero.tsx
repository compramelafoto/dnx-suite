import { BrushStroke } from "@/components/brand/BrushStroke";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { ViewfinderFrame } from "@/components/brand/ViewfinderFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { homeContent } from "@/content/home";

export function Hero() {
  const { hero } = homeContent;

  return (
    <Section
      id="inicio"
      tone="yellow"
      grain
      className="relative overflow-hidden border-b border-ck-border-strong"
      aria-labelledby="hero-title"
    >
      <CoordinateGrid className="opacity-[0.08]" />
      <Container className="relative z-[2] grid items-center gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-12">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="brand">{hero.eyebrow}</Badge>
            <EditorialLabel tone="dark">Experiencia</EditorialLabel>
          </div>
          <h1 id="hero-title" className="ck-display-xl mt-5 text-ck-black">
            {hero.title}
          </h1>
          <BrushStroke className="mt-4" />
          <p className="ck-body-lg mt-5 max-w-prose text-ck-gray-700">{hero.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={hero.primaryCta.href}>{hero.primaryCta.label}</Button>
            <Button href={hero.secondaryCta.href} variant="outline">
              {hero.secondaryCta.label}
            </Button>
          </div>
        </div>

        <div className="justify-self-center md:justify-self-end">
          <ViewfinderFrame />
        </div>
      </Container>
    </Section>
  );
}
