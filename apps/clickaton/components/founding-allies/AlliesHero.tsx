import Image from "next/image";
import { ConceptualNote } from "@/components/founding-allies/ConceptualNote";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { foundingAlliesContent } from "@/content/founding-allies";

const content = foundingAlliesContent;

export function AlliesHero() {
  const { hero } = content;

  return (
    <section
      className="relative overflow-hidden border-b border-ck-border"
      aria-labelledby="allies-hero-title"
    >
      <div className="absolute inset-0" aria-hidden>
        <Image
          src={hero.image.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.42] grayscale-[0.25]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.45)_0%,rgb(17_17_17_/_0.72)_48%,rgb(17_17_17_/_0.94)_100%)]" />
      </div>

      <Container className="relative z-[2] flex min-h-[100dvh] flex-col justify-end pb-16 pt-28 sm:pb-20 sm:pt-32 lg:pb-28 lg:pt-40">
        <p className="ck-overline ck-fade-up text-ck-yellow">{hero.eyebrow}</p>
        <h1
          id="allies-hero-title"
          className="ck-fade-up mt-8 max-w-[14ch] text-[clamp(2.75rem,9vw,7.5rem)] font-normal uppercase leading-[0.92] tracking-[0.02em] text-ck-text"
          style={{
            animationDelay: "60ms",
            fontFamily: "var(--ck-font-display)",
          }}
        >
          {hero.titleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p
          className="ck-accent-script ck-fade-up mt-8 max-w-xl text-2xl text-ck-text-secondary sm:text-3xl"
          style={{ animationDelay: "120ms" }}
        >
          {hero.subtitle}
        </p>
        <div
          className="ck-fade-up mt-12 flex flex-col gap-6 sm:mt-16 sm:flex-row sm:items-end sm:justify-between"
          style={{ animationDelay: "180ms" }}
        >
          <Button href={hero.cta.href} size="lg" className="w-full sm:w-auto">
            {hero.cta.label}
          </Button>
          <ConceptualNote className="max-w-xs sm:text-right sm:border-l-0 sm:border-r-2 sm:pl-0 sm:pr-3">
            {content.conceptualNote}
          </ConceptualNote>
        </div>
      </Container>
    </section>
  );
}
