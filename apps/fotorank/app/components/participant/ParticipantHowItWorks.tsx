const STEPS = [
  ["Inscripción", "Te anotás en el concurso y, si corresponde, pagás."],
  ["Carga", "Subís tus fotos mientras la carga está abierta y confirmás el envío."],
  ["Revisión", "El organizador controla que cada foto cumpla las bases."],
  ["Evaluación", "El jurado califica las fotos admitidas, sin ver tu nombre."],
  ["Resultados", "Se publican los ganadores y podés ver cómo te fue."],
] as const;

/** Explicación breve de las etapas, plegada para no ocupar lugar. */
export function ParticipantHowItWorks() {
  return (
    <details className="fr-pp-how">
      <summary className="fr-pp-how__summary">¿Cómo funciona un concurso?</summary>
      <ol className="fr-pp-how__list">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="fr-pp-how__item">
            <span className="fr-pp-how__num" aria-hidden>
              {i + 1}
            </span>
            <span>
              <strong>{title}</strong>
              <span className="fr-pp-how__text">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
