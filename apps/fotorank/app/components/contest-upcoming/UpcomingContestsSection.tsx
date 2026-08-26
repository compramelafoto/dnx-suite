/**
 * Sección pública de concursos próximos.
 *
 * Si no hay ninguno en UPCOMING no renderiza nada: un concurso en borrador
 * jamás llega hasta acá.
 *
 * Usa el sistema `public-ui` (mismo ritmo y contenedor que el resto de la home)
 * en lugar del chrome `fr-section`/`fr-container` heredado, para que la sección
 * no quede fuera de la estética pública.
 */
import { listPublicUpcomingContests } from "../../lib/fotorank/upcoming/service";
import { getMyContestInterestAction } from "../../actions/contest-interest";
import { PageContainer, PublicSectionHeader } from "../public-ui";
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
    <section
      id="proximamente"
      className="fr-public-section"
      aria-labelledby="home-upcoming-title"
    >
      <PageContainer>
        <PublicSectionHeader
          titleId="home-upcoming-title"
          eyebrow="Agenda"
          title="Próximos concursos"
          description="Convocatorias que todavía no abrieron la inscripción. Podés pedir que te avisemos cuando se habiliten."
        />
        <div className="fr-public-stack-content flex flex-wrap justify-center gap-8">
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
      </PageContainer>
    </section>
  );
}
