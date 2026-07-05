const SECTIONS = [
  {
    id: "costos-personales",
    title: "Costos personales",
    text: "Vivienda, alimentación, salud, transporte y todo lo que necesitás para vivir mientras trabajás como fotógrafo.",
    icon: "home",
  },
  {
    id: "costos-negocio",
    title: "Costos del negocio",
    text: "Alquiler de estudio, seguros, software, marketing, contabilidad y gastos operativos de tu actividad.",
    icon: "briefcase",
  },
  {
    id: "empleados",
    title: "Empleados y estructura",
    text: "Asistentes, editores, community managers u otros roles que forman parte de tu equipo o estructura.",
    icon: "team",
  },
  {
    id: "disponibilidad",
    title: "Disponibilidad horaria",
    text: "Cuántas horas reales podés dedicar a trabajar facturable cada mes, descontando vacaciones y tiempos muertos.",
    icon: "clock",
  },
  {
    id: "valor-hora",
    title: "Valor Hora Hombre",
    text: "El costo real de tu hora de trabajo: lo que necesitás cobrar por cada hora para cubrir todo y ganar.",
    icon: "calculator",
  },
  {
    id: "presupuestos",
    title: "Presupuestos profesionales",
    text: "Armá presupuestos claros para bodas, eventos, retratos o sesiones con márgenes y costos bien calculados.",
    icon: "document",
  },
  {
    id: "desglose",
    title: "Desglose final del dinero",
    text: "Visualizá a dónde va cada peso: costos fijos, variables, impuestos, ahorro para equipos y tu ganancia neta.",
    icon: "chart",
  },
] as const;

type SectionIcon = (typeof SECTIONS)[number]["icon"];

function SectionIconSvg({ type }: { type: SectionIcon }) {
  switch (type) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "briefcase":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM21 20c0-2.5-2-4-5-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "calculator":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "document":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <path
            d="M8 3h6l4 4v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 3v4h4M10 13h6M10 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <path d="M4 20V4M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M8 16v-4M12 16V8M16 16v-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export default function CuantoCobroFeatureGrid() {
  return (
    <section
      id="secciones"
      className="section-spacing bg-white scroll-mt-24"
      aria-labelledby="cuantocobro-sections-title"
    >
      <div className="container-custom ds-fill-width min-w-0">
        <div className="ds-stack-section text-center mb-10 sm:mb-14">
          <p className="cc-section-eyebrow">Tu cálculo paso a paso</p>
          <h2 id="cuantocobro-sections-title" className="cc-section-title">
            Todo lo que vas a considerar
          </h2>
          <p className="ds-intro-prose ds-readable-text ds-readable-text--fluid text-[var(--cc-color-muted)]">
            Cada sección te ayuda a entender un aspecto clave de tu negocio fotográfico antes de
            definir cuánto cobrar.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {SECTIONS.map((section, index) => (
            <article key={section.id} id={section.id} className="cc-feature-card min-w-0">
              <div className="flex items-start gap-4 min-w-0">
                <div className="cc-feature-card__icon" aria-hidden>
                  <SectionIconSvg type={section.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="cc-feature-card__step">Paso {index + 1}</span>
                  <h3 className="cc-feature-card__title">{section.title}</h3>
                </div>
              </div>
              <p className="cc-feature-card__text ds-readable-text ds-readable-text--fluid">
                {section.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
