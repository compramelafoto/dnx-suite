import { Container } from "@/components/layout/Container";
import { sobrePageContent } from "@/content/sobre";

const { finalPhrase } = sobrePageContent;

export function AboutFinalPhrase() {
  return (
    <section
      className="relative flex min-h-[70dvh] items-center justify-center bg-ck-yellow px-[var(--ck-gutter)] py-24 sm:min-h-[80dvh] sm:py-32"
      aria-labelledby="sobre-final-phrase"
    >
      <Container>
        <div className="mx-auto max-w-5xl text-center">
          <h2 id="sobre-final-phrase" className="sr-only">
            Cierre
          </h2>
          <p
            className="text-[clamp(1.75rem,6vw,4.25rem)] font-normal uppercase leading-[1.05] tracking-[0.02em] text-[var(--ck-text-on-brand)]"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            {finalPhrase.lines.map((line) => (
              <span key={line} className="mb-4 block sm:mb-6">
                {line}
              </span>
            ))}
          </p>
          <p
            className="mt-12 text-xl text-[var(--ck-text-on-brand)] sm:mt-16 sm:text-2xl"
            style={{ fontFamily: "var(--ck-font-accent, var(--ck-font-sans))" }}
          >
            {finalPhrase.remate}
          </p>
        </div>
      </Container>
    </section>
  );
}
