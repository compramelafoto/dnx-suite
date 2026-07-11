import Link from "next/link";

/** Bloque institucional de cierre editorial. */
export function HomeInstitutionalBlock() {
  return (
    <section
      aria-labelledby="home-institutional-heading"
      className="grid gap-8 rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-6 py-8 md:grid-cols-[1.4fr_1fr] md:gap-12 md:px-10 md:py-12"
    >
      <div>
        <p className="is-eyebrow">Ecosistema</p>
        <h2
          id="home-institutional-heading"
          className="is-h2 mt-3 text-2xl md:text-3xl"
        >
          Un medio conectado con los eventos
        </h2>
        <p className="is-body mt-5 max-w-xl">
          Info Spot acerca organizadores, fotógrafos y participantes a través
          de coberturas claras y cercanas. Contamos lo que pasa en el campo, en
          la calle y en la cultura, con rigor editorial.
        </p>
      </div>
      <div className="flex flex-col justify-center gap-3">
        <Link href="/quienes-somos" className="is-btn is-btn-primary w-fit min-h-11">
          Quiénes somos
        </Link>
        <Link href="/contacto" className="is-btn is-btn-secondary w-fit min-h-11">
          Contacto
        </Link>
      </div>
    </section>
  );
}
