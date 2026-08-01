const STEPS = [
  "Reservás tu lugar.",
  "Completás el pago.",
  "Recibís la confirmación.",
  "Participás de Clickatón.",
] as const;

export function RegistrationWhatHappensNext() {
  return (
    <section className="space-y-6" aria-labelledby="registration-after-title">
      <h2 id="registration-after-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        ¿Qué pasa después?
      </h2>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        {STEPS.map((label, index) => (
          <li key={label} className="relative flex flex-1 flex-col items-center text-center">
            <span className="flex size-10 items-center justify-center rounded-full border border-ck-border bg-ck-surface text-sm font-semibold text-ck-yellow">
              {index + 1}
            </span>
            <p className="mt-3 text-sm font-medium leading-snug text-ck-text">{label}</p>
            {index < STEPS.length - 1 ? (
              <>
                <span className="mt-1 text-ck-text-muted sm:hidden" aria-hidden>
                  ↓
                </span>
                <span
                  className="pointer-events-none absolute right-0 top-4 hidden translate-x-1/2 text-ck-text-muted sm:block"
                  aria-hidden
                >
                  →
                </span>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
