type Props = {
  /** Solo pasar si hay una métrica real disponible. No inventar. */
  participantCount?: number | null;
};

/**
 * Prueba social. Si no hay número real, muestra solo copy cualitativo oficial.
 * Cuando exista `participantCount`, se renderiza el dato.
 */
export function RegistrationSocialProof({ participantCount }: Props) {
  const hasCount =
    typeof participantCount === "number" &&
    Number.isFinite(participantCount) &&
    participantCount > 0;

  return (
    <section
      className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/40 px-6 py-8 text-center md:px-10"
      aria-labelledby="registration-social-title"
      data-social-proof={hasCount ? "metric" : "qualitative"}
    >
      <p className="text-lg text-ck-yellow" aria-hidden>
        ⭐⭐⭐⭐⭐
      </p>
      <h2 id="registration-social-title" className="mt-3 text-lg font-semibold tracking-tight md:text-xl">
        {hasCount
          ? `Más de ${participantCount.toLocaleString("es-AR")} fotógrafos participaron en nuestras ediciones.`
          : "La comunidad de fotógrafos más grande de tu ciudad."}
      </h2>
      {!hasCount ? (
        <p className="mt-2 text-sm text-ck-text-secondary">
          Clickatón reúne a quienes salen a observar, crear y compartir.
        </p>
      ) : null}
    </section>
  );
}
