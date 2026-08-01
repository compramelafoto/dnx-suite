import type { ParticipantPersona } from "./participant-persona";

type Props = {
  persona: ParticipantPersona;
  remainingCredits?: number | null;
};

export function RegistrationWelcomeBanner({ persona, remainingCredits }: Props) {
  if (persona === "new") return null;

  if (persona === "pack_holder") {
    return (
      <div
        className="rounded-[var(--ck-radius-card)] border border-ck-yellow/50 bg-ck-yellow/10 px-6 py-6 md:px-8"
        role="status"
      >
        <p className="text-lg font-semibold text-ck-text md:text-xl">
          ⭐ Tenés un Pack activo
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ck-text-secondary md:text-base">
          Usá tu Pack y participá sin volver a pagar.
          {remainingCredits != null
            ? ` Te quedan ${remainingCredits} uso${remainingCredits === 1 ? "" : "s"}.`
            : null}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/50 px-6 py-6 md:px-8"
      role="status"
    >
      <p className="text-lg font-semibold text-ck-text md:text-xl">
        👋 ¡Qué bueno verte nuevamente!
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ck-text-secondary md:text-base">
        Gracias por volver a participar de una Clickatón.
      </p>
    </div>
  );
}
