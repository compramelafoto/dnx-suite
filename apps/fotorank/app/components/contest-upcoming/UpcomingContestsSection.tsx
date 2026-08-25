/**
 * Sección pública de concursos próximos.
 *
 * Si no hay ninguno en UPCOMING no renderiza nada: un concurso en borrador
 * jamás llega hasta acá.
 */
import { listPublicUpcomingContests } from "../../lib/fotorank/upcoming/service";
import { getMyContestInterestAction } from "../../actions/contest-interest";
import { UpcomingContestCard } from "./UpcomingContestCard";

export async function UpcomingContestsSection() {
  const cards = await listPublicUpcomingContests(6);
  if (cards.length === 0) return null;

  const withInterest = await Promise.all(
    cards.map(async (card) => ({
      card,
      interest: await getMyContestInterestAction(card.id),
    })),
  );

  return (
    <section id="proximamente" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <h2 className="mb-10 text-center font-sans text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl">
          Próximos concursos
        </h2>
        <div className="flex flex-wrap justify-center gap-8">
          {withInterest.map(({ card, interest }) => (
            <UpcomingContestCard
              key={card.id}
              card={card}
              interest={
                interest
                  ? { status: interest.status, benefitEligible: interest.benefitEligible }
                  : null
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
