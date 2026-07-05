"use client";

import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import CuantoCobroLogo from "@/components/cuantocobro/CuantoCobroLogo";

type Props = {
  onStart: () => void;
};

export default function CuantoCobroHero({ onStart }: Props) {
  return (
    <section
      className="relative overflow-hidden w-full bg-[var(--cc-color-bg-soft)]"
      aria-labelledby="cuantocobro-hero-title"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.12),transparent_55%)]"
        aria-hidden
      />

      <div className="relative container-custom section-spacing !pb-16 sm:!pb-20 md:!pb-28">
        <div className="cc-hero-inner text-center ds-stack-section">
          <CuantoCobroLogo variant="hero" href="/cuantocobro" className="mx-auto" />

          <h1 id="cuantocobro-hero-title" className="sr-only">
            ¿Cuánto Cobro?
          </h1>

          <p className="clf-hero-text ds-readable-text ds-readable-text--fluid text-lg sm:text-xl font-medium text-[var(--cc-color-dark)]/90">
            La mayoría de los fotógrafos saben cuánto cobran. Muy pocos saben cuánto ganan realmente.
          </p>

          <p className="clf-hero-text ds-readable-text ds-readable-text--fluid text-base text-[var(--cc-color-text)] md:text-lg">
            Calculá tus costos personales, los gastos de tu negocio, la renovación de tus equipos, tu
            disponibilidad de trabajo y descubrí cuánto deberías cobrar para construir una actividad
            fotográfica rentable y sostenible.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
            <CuantoCobroButton
              type="button"
              variant="primary"


              className="w-full sm:w-auto min-h-[44px] px-8"
              onClick={onStart}
            >
              Comenzar cálculo
            </CuantoCobroButton>
            <a href="#secciones" className="inline-flex justify-center sm:inline w-full sm:w-auto">
              <CuantoCobroButton
                variant="secondary"

                className="w-full sm:w-auto min-h-[44px] px-8 border-[color:var(--cc-color-border-strong)] text-[var(--cc-color-dark)] hover:border-[color:var(--cc-color-primary)]"
              >
                Ver secciones
              </CuantoCobroButton>
            </a>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--cc-color-primary)]/25 to-transparent"
        aria-hidden
      />
    </section>
  );
}
