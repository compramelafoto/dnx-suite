const CARDS = [
  "No necesitás experiencia profesional.",
  "Podés participar con cualquier cámara.",
  "También podés participar con celular.",
  "No necesitás imprimir fotografías.",
] as const;

export function RegistrationReassuranceCards() {
  return (
    <section className="space-y-4" aria-labelledby="registration-reassure-title">
      <h2 id="registration-reassure-title" className="sr-only">
        Tranquilidad para participar
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((text) => (
          <li
            key={text}
            className="rounded-[var(--ck-radius-card)] border border-ck-border/80 bg-ck-surface/30 px-4 py-4 text-sm leading-relaxed text-ck-text-secondary md:px-5"
          >
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
