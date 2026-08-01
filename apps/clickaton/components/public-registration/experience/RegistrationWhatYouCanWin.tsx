const ITEMS = [
  { title: "Premios", body: "Reconocimientos de la edición." },
  { title: "Reconocimiento", body: "Tu mirada puede destacar." },
  { title: "Difusión", body: "Visibilidad en los canales oficiales." },
  { title: "Exposición", body: "Tus fotos pueden mostrarse a la comunidad." },
] as const;

type Props = {
  /** Si en el futuro hay datos de premios, se puede ocultar/mostrar. Por defecto visible (experiencia). */
  enabled?: boolean;
};

export function RegistrationWhatYouCanWin({ enabled = true }: Props) {
  if (!enabled) return null;

  return (
    <section className="space-y-6" aria-labelledby="registration-win-title">
      <h2 id="registration-win-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        ¿Qué podés ganar?
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <li
            key={item.title}
            className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/40 p-5"
          >
            <h3 className="font-semibold text-ck-yellow">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ck-text-secondary">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
