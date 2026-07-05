const FEATURES = [
  {
    id: "manual",
    title: "Cámara Manual",
    text: "Aprendé a controlar ISO, tiempo de exposición, diafragma y balance de blancos como en una cámara real.",
    icon: "aperture",
    soon: false,
  },
  {
    id: "lighting",
    title: "Escenarios de Luz",
    text: "Practicá contraluces, interiores, exteriores, luz dura, luz suave y situaciones reales.",
    icon: "sun",
    soon: false,
  },
  {
    id: "training",
    title: "Entrenamiento Interactivo",
    text: "Movete libremente por los escenarios y resolvé desafíos fotográficos.",
    icon: "move",
    soon: false,
  },
  {
    id: "upcoming",
    title: "Próximamente",
    text: "Flash, modificadores de luz, ejercicios guiados y certificaciones.",
    icon: "spark",
    soon: true,
  },
] as const;

function FeatureIcon({ type }: { type: (typeof FEATURES)[number]["icon"] }) {
  switch (type) {
    case "aperture":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "move":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="M12 2v20M2 12h20M7 7l5 5 5-5M7 17l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
  }
}

export default function SimulatorFeatures() {
  return (
    <section id="modulos" className="cod-features" aria-labelledby="cod-features-title">
      <div className="cod-features__inner">
        <p className="cod-section-label">Módulos de entrenamiento</p>
        <h2 id="cod-features-title" className="cod-section-title">
          Aprendé practicando
        </h2>

        <div className="cod-features__grid">
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              className={`cod-feature-card${feature.soon ? " cod-feature-card--soon" : ""}`}
            >
              <div className="cod-feature-card__icon">
                <FeatureIcon type={feature.icon} />
              </div>
              <h3 className="cod-feature-card__title">{feature.title}</h3>
              <p className="cod-feature-card__text">{feature.text}</p>
              {feature.soon && <span className="cod-feature-card__tag">En desarrollo</span>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
