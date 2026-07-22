import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { organizarSedeContent } from "@/content/organizar-sede";

const { hero } = organizarSedeContent;

export function OrganizerHero() {
  return (
    <section
      className="relative overflow-hidden border-b border-ck-border"
      aria-labelledby="organizer-hero-title"
    >
      <div className="absolute inset-0 bg-ck-bg" aria-hidden>
        <Image
          src={hero.image.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.38]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.2)_0%,rgb(17_17_17_/_0.45)_45%,rgb(17_17_17_/_0.82)_100%)]" />
        <div className="ck-grain absolute inset-0 opacity-30" />
      </div>

      <Container className="relative z-[2] flex min-h-[100dvh] flex-col justify-end pb-12 pt-28 sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-40">
        <p className="ck-fade-up ck-overline text-ck-yellow">Organizadores Oficiales de Sede</p>
        <h1
          id="organizer-hero-title"
          className="ck-fade-up mt-6 max-w-[14ch] text-[clamp(2.75rem,9vw,7rem)] font-normal uppercase leading-[0.92] tracking-[0.02em] text-ck-text"
          style={{ fontFamily: "var(--ck-font-display)", animationDelay: "40ms" }}
        >
          {hero.title}
        </h1>
        <p
          className="ck-body-lg ck-fade-up mt-8 max-w-2xl text-ck-text-secondary sm:text-xl"
          style={{ animationDelay: "100ms" }}
        >
          {hero.subtitle}
        </p>
        <div className="ck-fade-up mt-10 sm:mt-12" style={{ animationDelay: "160ms" }}>
          <Button href={hero.cta.href} size="lg" className="w-full sm:w-auto">
            {hero.cta.label}
          </Button>
        </div>
      </Container>

      <span className="sr-only">{hero.image.alt}</span>
    </section>
  );
}
