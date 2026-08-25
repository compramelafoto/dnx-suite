/**
 * Landing pública de un concurso en fase "PRÓXIMAMENTE".
 *
 * Muestra la información de convocatoria y el registro de interés. No expone
 * precios ni permite carga de obras: en UPCOMING ninguna de las dos cosas está
 * habilitada.
 */
import type { UpcomingContestCard as CardData } from "../../lib/fotorank/upcoming/service";
import { UpcomingContestCard } from "./UpcomingContestCard";

export type UpcomingContestLandingProps = {
  card: CardData;
  interest: { status: "ACTIVE" | "CANCELLED" | "CONVERTED"; benefitEligible: boolean } | null;
  brief?: { title: string; text: string } | null;
  previewMode?: boolean;
};

export function UpcomingContestLanding({
  card,
  interest,
  brief,
  previewMode = false,
}: UpcomingContestLandingProps) {
  return (
    <main className="min-h-screen bg-fr-bg text-fr-primary">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1fr_auto] md:px-10 md:py-24">
        <div className="space-y-8">
          <p className="fr-eyebrow text-gold">{card.badge}</p>
          <h1 className="font-sans text-4xl font-semibold uppercase tracking-tight md:text-6xl">
            {card.title}
          </h1>
          {card.tagline ? <p className="text-xl text-gold md:text-2xl">{card.tagline}</p> : null}
          {card.summary ? (
            <p className="max-w-2xl text-base leading-relaxed text-[#a1a1a1]">{card.summary}</p>
          ) : null}

          <p className="text-sm text-[#8a8a8a]">
            Organiza <span className="text-fr-primary">{card.organizerName}</span>
          </p>

          {brief ? (
            <section className="space-y-4 border-t border-fr-border pt-8">
              <h2 className="font-sans text-2xl font-semibold">{brief.title}</h2>
              {brief.text.split("\n\n").map((paragraph, i) => (
                <p key={i} className="max-w-2xl text-sm leading-relaxed text-[#a1a1a1]">
                  {paragraph}
                </p>
              ))}
            </section>
          ) : null}

          <p className="max-w-2xl text-xs leading-relaxed text-[#6b6b6b]">
            Las inscripciones todavía no están abiertas. Registrarte para recibir el aviso no
            implica ningún pago ni compromiso de participación.
          </p>
        </div>

        <div className="md:pt-16">
          <UpcomingContestCard card={card} interest={interest} previewMode={previewMode} />
        </div>
      </div>
    </main>
  );
}
