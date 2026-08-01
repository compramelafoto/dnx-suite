const BLOCKS = [
  { title: "Aprendé.", body: "Salí a mirar con consignas y ritmo de maratón." },
  { title: "Conocé fotógrafos.", body: "Comunidad real, en la calle y en la plataforma." },
  { title: "Viví una experiencia diferente.", body: "Un día pensado para crear, no solo competir." },
] as const;

export function RegistrationWhyParticipate() {
  return (
    <section className="space-y-6" aria-labelledby="registration-why-title">
      <h2 id="registration-why-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        ¿Por qué participar?
      </h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {BLOCKS.map((block) => (
          <li
            key={block.title}
            className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/40 p-5 md:p-6"
          >
            <h3 className="text-lg font-semibold text-ck-text">{block.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ck-text-secondary">{block.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
