import Image from "next/image";
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
      flush
      className="ck-vignette relative overflow-hidden border-b border-ck-border"
      aria-labelledby="hero-title"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <Image
          src="/images/hero-city-photographer.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover object-[center_40%] grayscale opacity-[0.24] blur-[2px]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.4)_0%,rgb(17_17_17_/_0.58)_48%,rgb(17_17_17_/_0.82)_100%)]" />
      </div>

      <Container className="relative z-[2] flex min-h-[calc(100dvh-7rem)] flex-col justify-center py-10 sm:py-12 md:py-14">
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{hero.eyebrow}</p>
          <h1
            id="hero-title"
            className="ck-display-xl mt-4 max-w-[16ch] break-words text-ck-text sm:mt-5 [overflow-wrap:anywhere]"
          >
            {hero.title}
          </h1>
          <p className="ck-accent-script mt-4 text-xl text-ck-text-secondary sm:mt-5 md:text-2xl">
            {hero.tagline}
          </p>
          <BrushStroke className="mt-3 sm:mt-4" />
          <p className="ck-body-lg mt-6 max-w-prose text-ck-text-secondary sm:mt-7">
            {hero.description}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
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
          <p className="ck-caption mt-6 text-ck-text-muted">
            Mirar · crear · aprender · compartir
          </p>
        </div>
      </Container>
    </Section>
  );
}
