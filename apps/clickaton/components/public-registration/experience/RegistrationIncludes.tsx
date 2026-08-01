type Props = {
  shirtMention?: boolean;
};

const BASE = [
  "Tu lugar en la Clickatón",
  "Tu número de participante",
  "Acceso a las consignas del día",
  "Certificado digital",
] as const;

export function RegistrationIncludes({ shirtMention = true }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="registration-includes-title">
      <h2 id="registration-includes-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        Tu inscripción incluye
      </h2>
      <ul className="space-y-2 text-sm text-ck-text md:text-base">
        {BASE.map((item) => (
          <li key={item}>✔ {item}</li>
        ))}
      </ul>
      {shirtMention ? (
        <p className="mt-4 rounded-[var(--ck-radius-card)] border border-ck-border/70 bg-ck-surface/30 px-4 py-3 text-sm leading-relaxed text-ck-text-secondary">
          Además, según la etapa vigente, tu inscripción puede incluir una remera oficial Clickatón.
        </p>
      ) : null}
    </section>
  );
}
