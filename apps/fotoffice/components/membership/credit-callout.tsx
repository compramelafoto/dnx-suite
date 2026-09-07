import { formatMinorArs } from "@/lib/membership/money";

/**
 * El saldo a favor del socio.
 *
 * Se le habla distinto a cada uno: al socio se le dice qué va a pasar con esa plata, a la
 * Secretaría se le dice qué tiene que esperar del próximo cierre. El mismo número contado dos
 * veces igual sería una de las dos explicaciones sobrando.
 */
export function CreditCallout({
  creditMinor,
  tone,
}: {
  creditMinor: number;
  tone: "socio" | "panel";
}) {
  if (creditMinor <= 0) return null;

  return (
    <section className="fo-card space-y-2 border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] p-5">
      <h2 className="text-sm font-semibold text-[var(--fo-success)]">
        {tone === "socio" ? "Tenés saldo a favor" : "Saldo a favor"}
      </h2>
      <p className="text-2xl font-semibold tabular-nums">{formatMinorArs(creditMinor)}</p>
      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        {tone === "socio"
          ? "Se va a descontar solo de tus próximas cuotas. No hace falta que hagas nada."
          : "Se imputa solo a las cuotas que se generen. No aparece como deuda ni como cobro nuevo."}
      </p>
    </section>
  );
}
