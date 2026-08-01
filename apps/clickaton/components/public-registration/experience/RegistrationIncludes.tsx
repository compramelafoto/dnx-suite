import {
  presentShirtBenefitMessage,
  type ShirtBenefitUiStatus,
} from "@/lib/catalog/domain/first-n-benefit";

type Props = {
  shirtBenefitStatus?: ShirtBenefitUiStatus;
};

const BASE = [
  "Tu lugar en la Clickatón",
  "Tu número de participante",
  "Acceso a las consignas del día",
  "Certificado digital",
] as const;

export function RegistrationIncludes({
  shirtBenefitStatus = "not_applicable",
}: Props) {
  const shirtMessage = presentShirtBenefitMessage(shirtBenefitStatus);

  return (
    <section className="space-y-4" aria-labelledby="registration-includes-title">
      <h2 id="registration-includes-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        Tu inscripción incluye
      </h2>
      <ul className="space-y-2 text-sm text-ck-text md:text-base">
        {BASE.map((item) => (
          <li key={item}>✔ {item}</li>
        ))}
        {shirtBenefitStatus === "available" ? (
          <li>✔ Remera oficial de regalo (si confirmás el pago a tiempo)</li>
        ) : null}
      </ul>
      {shirtMessage ? (
        <p
          className={
            shirtBenefitStatus === "available"
              ? "mt-4 rounded-[var(--ck-radius-card)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-200"
              : "mt-4 rounded-[var(--ck-radius-card)] border border-ck-border/70 bg-ck-surface/30 px-4 py-3 text-sm leading-relaxed text-ck-text-secondary"
          }
          role="status"
        >
          {shirtMessage}
        </p>
      ) : null}
    </section>
  );
}
