const benefits = [
  { title: "Mayor alcance", text: "Tu evento llega a quien busca qué hacer." },
  { title: "Cobertura fotográfica", text: "Convocá profesionales para contarlo." },
  { title: "Difusión antes y después", text: "Agenda previa + relato editorial." },
  { title: "Organización", text: "Un lugar claro para presentar tu propuesta." },
  { title: "Inscripciones", text: "Próximamente, online y sin fricción." },
  { title: "Acreditaciones", text: "Próximamente, para prensa y equipos." },
  { title: "Visibilidad", text: "Presencia editorial que suma búsqueda." },
  { title: "Comunidad", text: "Organizadores, fotógrafos y participantes." },
] as const;

/** Beneficios visuales — por qué publicar (sin texto largo). */
export function HomeWhyPublish() {
  return (
    <section aria-labelledby="home-why-heading">
      <div className="mb-12 max-w-2xl md:mb-14">
        <p className="is-eyebrow">Propuesta</p>
        <h2
          id="home-why-heading"
          className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
        >
          ¿Por qué publicar en Info Spot?
        </h2>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {benefits.map((item) => (
          <li
            key={item.title}
            className="border-t border-[var(--is-border)] pt-5"
          >
            <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-[var(--is-text)]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--is-text-secondary)]">
              {item.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
