import { Container } from "@/components/layout/Container";
import { formarParteContent } from "@/content/formar-parte";

const { final } = formarParteContent;

/** Pantalla completa con fondo amarillo institucional — excepción deliberada del brief. */
export function JoinFinalCta() {
  return (
    <section
      className="relative flex min-h-[100dvh] items-center justify-center bg-ck-yellow px-[var(--ck-gutter)] py-24 sm:py-32"
      aria-labelledby="join-final-title"
    >
      <Container className="relative z-[1]">
        <div className="mx-auto max-w-5xl text-center">
          <h2
            id="join-final-title"
            className="text-[clamp(2.25rem,8vw,5.75rem)] font-normal uppercase leading-[0.95] tracking-[0.02em] text-[var(--ck-text-on-brand)]"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            <span className="block">{final.line1}</span>
            <span className="mt-4 block sm:mt-6">{final.line2}</span>
          </h2>
          <div className="mt-14 flex justify-center sm:mt-16">
            {/*
              Enlace propio (no Button primary): evita choque de clases
              bg-ck-yellow / text-ck-yellow sobre fondo amarillo.
            */}
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
