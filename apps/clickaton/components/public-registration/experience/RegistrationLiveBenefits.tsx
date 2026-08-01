type Props = {
  cityHint?: string | null;
};

export function RegistrationLiveBenefits({ cityHint }: Props) {
  const items = [
    {
      icon: "📸",
      title: cityHint?.trim() ? `Fotografiá ${cityHint.trim()}` : "Fotografiá la ciudad",
      body: "Salí a disparar con consignas y ritmo de maratón.",
    },
    {
      icon: "👥",
      title: "Compartí con cientos de fotógrafos",
      body: "Comunidad, energía y encuentros reales.",
    },
    {
      icon: "🏆",
      title: "Competí por premios",
      body: "Tu mirada puede destacar en la edición.",
    },
    {
      icon: "🎯",
      title: "Consignas sorpresa",
      body: "Desafíos que te sacan de la zona de confort.",
    },
    {
      icon: "🎁",
      title: "Beneficios exclusivos para participantes",
      body: "Acceso completo a la experiencia Clickatón.",
    },
  ] as const;

  return (
    <section className="space-y-8" aria-labelledby="registration-live-title">
      <h2 id="registration-live-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
        ¿Qué vas a vivir?
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.title}
            className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/50 p-6 md:p-8"
          >
            <p className="text-3xl" aria-hidden>
              {item.icon}
            </p>
            <h3 className="mt-4 text-lg font-semibold text-ck-text">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ck-text-secondary">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
