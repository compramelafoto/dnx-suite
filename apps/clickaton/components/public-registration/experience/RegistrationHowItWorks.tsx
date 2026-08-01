const STEPS = [
  { n: "1", icon: "📍", title: "Reservás tu lugar" },
  { n: "2", icon: "🎫", title: "Recibís tu acreditación" },
  { n: "3", icon: "📸", title: "Salís a fotografiar" },
  { n: "4", icon: "⬆️", title: "Subís tus mejores fotos" },
  { n: "5", icon: "🏆", title: "Competís por premios" },
] as const;

export function RegistrationHowItWorks() {
  return (
    <section className="space-y-8" aria-labelledby="registration-how-title">
      <h2 id="registration-how-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
        ¿Cómo funciona?
      </h2>
      <ol className="flex flex-col gap-4 sm:grid sm:grid-cols-5 sm:gap-3">
        {STEPS.map((step, index) => (
          <li key={step.n} className="relative flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-ck-border bg-ck-surface text-2xl transition duration-200 ease-out hover:border-ck-yellow/50 hover:bg-ck-yellow/5 hover:shadow-[0_0_24px_rgb(250_204_21_/_0.12)]">
              <span aria-hidden>{step.icon}</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug text-ck-text">
              <span className="sr-only">Paso {step.n}. </span>
              {step.title}
            </p>
            {index < STEPS.length - 1 ? (
              <>
                <span className="mt-1 text-ck-yellow sm:hidden" aria-hidden>
                  ↓
                </span>
                <span
                  className="pointer-events-none absolute right-0 top-7 hidden translate-x-1/2 text-ck-yellow sm:block"
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
