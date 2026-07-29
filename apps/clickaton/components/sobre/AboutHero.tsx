import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/layout/Container";
import { sobrePageContent } from "@/content/sobre";

const { hero } = sobrePageContent;

export function AboutHero() {
  return (
    <section
      id="presentacion"
      className="relative overflow-hidden border-b border-ck-border scroll-mt-28"
      aria-labelledby="sobre-hero-title"
    >
      <div className="absolute inset-0 bg-ck-bg" aria-hidden>
        <Image
          src={hero.image.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%] opacity-[0.28] grayscale"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.35)_0%,rgb(17_17_17_/_0.72)_55%,rgb(17_17_17_/_0.94)_100%)]" />
        <div className="ck-grain absolute inset-0 opacity-30" />
      </div>

      <Container className="relative z-[2] py-10 sm:py-12 md:py-14 lg:py-16">
        <div className="ck-fade-up">
          <Logo
            variant="principal"
            href={null}
            priority
            className="h-20 w-auto sm:h-24 md:h-28 lg:h-32"
          />
        </div>

        <h1
          id="sobre-hero-title"
          className="ck-fade-up mt-8 max-w-[18ch] text-[clamp(2.25rem,7vw,5rem)] font-normal uppercase leading-[0.92] tracking-[0.02em] text-ck-text sm:mt-10"
          style={{ fontFamily: "var(--ck-font-display)", animationDelay: "60ms" }}
        >
          {hero.title}
        </h1>

        <p
          className="ck-fade-up mt-5 max-w-2xl text-lg text-ck-yellow sm:mt-6 sm:text-xl md:text-2xl"
          style={{
            fontFamily: "var(--ck-font-sans)",
            fontWeight: 600,
            animationDelay: "120ms",
          }}
        >
          {hero.subtitle}
        </p>

        <div
          className="ck-fade-up mt-6 max-w-2xl space-y-4 sm:mt-8"
          style={{ animationDelay: "180ms" }}
        >
          <p className="ck-body-lg text-ck-text">{hero.lead}</p>
          <p className="ck-body-lg text-ck-text-secondary">{hero.body}</p>
        </div>
      </Container>

      <span className="sr-only">{hero.image.alt}</span>
    </section>
  );
}
