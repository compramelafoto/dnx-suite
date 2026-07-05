"use client";

const FUTURE_LIGHTING = [
  { title: "Flash sobre cámara", description: "Luz directa en el eje del objetivo." },
  { title: "Flash fuera de cámara", description: "Modelado lateral y control de sombras." },
  { title: "Pantalla 5 en 1", description: "Relleno, contraluz y rebote de luz natural." },
  { title: "Softbox", description: "Luz suave para retrato y producto." },
  { title: "Luz continua", description: "Video y aprendizaje de dirección de luz." },
  { title: "Rebote en pared/techo", description: "Suavizar flash directo con superficies." },
] as const;

export default function LightingTab() {
  return (
    <div
      className="cod-side-panel cod-lighting-panel"
      role="tabpanel"
      id="cod-side-panel-lighting"
      aria-labelledby="cod-side-tab-lighting"
    >
      <p className="cod-lighting-panel__badge">Próximamente</p>
      <p className="cod-lighting-panel__intro">
        Aquí podrás añadir y controlar fuentes de luz para practicar iluminación de estudio y
        exteriores.
      </p>

      <div className="cod-lighting-future" aria-label="Iluminación planificada">
        {FUTURE_LIGHTING.map((item) => (
          <article key={item.title} className="cod-lighting-future__card">
            <h3 className="cod-lighting-future__title">{item.title}</h3>
            <p className="cod-lighting-future__desc">{item.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
