import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { formarParteContent } from "@/content/formar-parte";

const { hero } = formarParteContent;

export function JoinHero() {
  return (
    <section
      className="relative overflow-hidden border-b border-ck-border"
      aria-labelledby="join-hero-title"
    >
      <div className="absolute inset-0 bg-ck-bg" aria-hidden>
        <Image
          src={hero.image.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-30"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.15)_0%,rgb(17_17_17_/_0.35)_50%,rgb(17_17_17_/_0.55)_100%)]" />
      </div>

      <Container className="relative z-[2] flex min-h-[100dvh] flex-col justify-end pb-12 pt-28 sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-40">
        <h1
          id="join-hero-title"
          className="ck-fade-up max-w-[16ch] text-[clamp(2.75rem,9vw,7rem)] font-normal uppercase leading-[0.92] tracking-[0.02em] text-ck-text"
          style={{ fontFamily: "var(--ck-font-display)" }}
        >
          {hero.title}
        </h1>
        <p
          className="ck-body-lg ck-fade-up mt-8 max-w-2xl text-ck-text-secondary sm:text-xl"
          style={{ animationDelay: "80ms" }}
        >
          {hero.subtitle}
        </p>
        <div className="ck-fade-up mt-10 sm:mt-12" style={{ animationDelay: "140ms" }}>
          <Button href={hero.cta.href} size="lg" className="w-full sm:w-auto">
            {hero.cta.label}
          </Button>
        </div>

        <div
          className="ck-fade-up mt-16 border-t border-ck-border pt-10 sm:mt-20"
          style={{ animationDelay: "200ms" }}
        >
          <p className="ck-caption mb-6 text-ck-text-muted">{hero.metricsNote}</p>
          <ul className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-10">
            {hero.metrics.map((metric) => (
              <li key={metric.label} className="min-w-0">
                <p
                  className="text-[clamp(2rem,5vw,3.25rem)] font-normal uppercase leading-none tracking-wide text-ck-yellow"
                  style={{ fontFamily: "var(--ck-font-display)" }}
                >
                  {metric.value}
                </p>
                <p className="ck-label mt-3 text-ck-text-muted">{metric.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <span className="sr-only">{hero.image.alt}</span>
    </section>
  );
}
