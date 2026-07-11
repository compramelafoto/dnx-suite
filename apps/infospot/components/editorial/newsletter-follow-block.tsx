import Link from "next/link";

/**
 * Newsletter / follow — solo visual.
 * No promete suscripción funcional.
 */
export function NewsletterOrFollowBlock() {
  return (
    <aside
      aria-labelledby="home-follow-heading"
      className="rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-surface)] px-6 py-8 md:px-10 md:py-10"
    >
      <p className="is-eyebrow">Seguí Info Spot</p>
      <h2 id="home-follow-heading" className="is-h2 mt-3 text-2xl md:text-3xl">
        Enterate de lo que pasa cerca tuyo
      </h2>
      <p className="is-body mt-4 max-w-xl">
        El boletín editorial está en preparación. Mientras tanto, explorá las
        coberturas publicadas y escribinos si organizás un evento.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className="flex min-h-11 flex-1 items-center rounded-[var(--is-radius-md)] border border-[var(--is-border)] px-4 text-sm text-[var(--is-muted)]"
          aria-hidden
        >
          tu@email.com
        </div>
        <button
          type="button"
          className="is-btn is-btn-primary min-h-11"
          disabled
          title="Próximamente"
        >
          Próximamente
        </button>
      </div>
      <p className="is-metadata mt-4">
        ¿Organizás un evento?{" "}
        <Link
          href="/contacto"
          className="font-medium text-[var(--is-accent)] hover:underline"
        >
          Contacto de prensa
        </Link>
      </p>
    </aside>
  );
}
