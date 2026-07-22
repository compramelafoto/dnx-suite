import { Container } from "@/components/layout/Container";
import { organizarSedeContent } from "@/content/organizar-sede";

const { final } = organizarSedeContent;

/** Pantalla completa con fondo amarillo institucional — misma línea que Formá Parte. */
export function OrganizerFinalCta() {
  return (
    <section
      className="relative flex min-h-[100dvh] items-center justify-center bg-ck-yellow px-[var(--ck-gutter)] py-24 sm:py-32"
      aria-labelledby="organizer-final-title"
    >
      <Container className="relative z-[1]">
        <div className="mx-auto max-w-5xl text-center">
          <h2
            id="organizer-final-title"
            className="text-[clamp(2.25rem,8vw,5.5rem)] font-normal uppercase leading-[0.95] tracking-[0.02em] text-[var(--ck-text-on-brand)]"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            {final.title}
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[var(--ck-text-on-brand)]/85 sm:mt-10 sm:text-lg">
            {final.body}
          </p>
          <div className="mt-14 flex justify-center sm:mt-16">
            <a
              href={final.cta.href}
              className="ck-button-label inline-flex min-h-12 items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-[#111111] bg-[#111111] px-6 py-3 text-ck-yellow transition-[background-color,color,transform] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:bg-[#1a1a1a]"
            >
              {final.cta.label}
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
