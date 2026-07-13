import Link from "next/link";

/**
 * Agenda del fin de semana — bloque futuro.
 * No muestra datos ficticios ni stock sin identificar.
 */
export function HomeWeekendAgenda() {
  return (
    <section aria-labelledby="home-weekend-heading">
      <div className="mb-8 max-w-2xl md:mb-12">
        <p className="is-eyebrow">Próximamente</p>
        <h2
          id="home-weekend-heading"
          className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
        >
          Agenda del fin de semana
        </h2>
        <p className="is-body mt-3">
          Estamos preparando una agenda inteligente con eventos reales de tu
          zona. Mientras tanto, explorá el listado completo de eventos
          publicados.
        </p>
      </div>

      <div className="rounded-[var(--is-radius)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-surface)] px-6 py-10 md:px-8 md:py-12">
        <p className="is-body max-w-xl">
          Este bloque se activará cuando haya eventos próximos cargados
          para el fin de semana. No mostramos agenda demo en producción.
        </p>
        <p className="mt-8">
          <Link href="/eventos" className="is-btn is-btn-solid min-h-11">
            Ver eventos
          </Link>
        </p>
      </div>
    </section>
  );
}
