const steps = [
  {
    n: "01",
    title: "Publicás tu evento",
    text: "Contá qué, cuándo y dónde. Sin fricción.",
  },
  {
    n: "02",
    title: "Miles de personas lo descubren",
    text: "Aparece en la agenda viva de Info Spot.",
  },
  {
    n: "03",
    title: "Fotógrafos solicitan cobertura",
    text: "Quienes quieren trabajar se suman a la convocatoria.",
  },
  {
    n: "04",
    title: "Se publica la noticia",
    text: "Antes, durante y después: el relato editorial.",
  },
  {
    n: "05",
    title: "Las fotos llegan a ComprameLaFoto",
    text: "La cobertura sigue viva para participantes.",
  },
  {
    n: "06",
    title: "Más personas conocen tu evento",
    text: "Difusión que crece con cada historia publicada.",
  },
] as const;

/** Recorrido visual — cómo funciona Info Spot (sin backend). */
export function HomeHowItWorks() {
  return (
    <section aria-labelledby="home-how-heading">
      <div className="mb-12 max-w-2xl md:mb-16">
        <p className="is-eyebrow">El recorrido</p>
        <h2
          id="home-how-heading"
          className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
        >
          ¿Cómo funciona?
        </h2>
        <p className="is-body mt-4">
          Una historia simple: del organizador a la comunidad, pasando por la
          fotografía y la noticia.
        </p>
      </div>

      <ol className="grid gap-0 border-t border-[var(--is-border)] md:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.n}
            className="relative border-b border-[var(--is-border)] py-8 pr-6 md:border-r md:px-6 md:odd:pl-0 lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(3n+1)]:pl-0"
          >
            <p className="font-display text-3xl font-bold tabular-nums tracking-tight text-[var(--is-orange-500)] md:text-4xl">
              {step.n}
            </p>
            <h3 className="is-h3 mt-4 text-lg md:text-xl">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--is-text-secondary)] md:text-[0.9375rem]">
              {step.text}
            </p>
            {index < steps.length - 1 ? (
              <span
                className="pointer-events-none absolute bottom-4 right-4 hidden text-[var(--is-border-strong)] lg:block"
                aria-hidden
              >
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
