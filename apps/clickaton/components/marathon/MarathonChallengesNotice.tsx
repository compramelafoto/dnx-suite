import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import {
  countHiddenChallenges,
  getPublicVisibleChallenges,
} from "@/lib/challenges";
import type { PublicMarathon } from "@/types/marathon";

type MarathonChallengesNoticeProps = {
  marathon: PublicMarathon;
};

/**
 * Bloque seguro de consignas.
 * Nunca renderiza título/descripción de consignas no liberadas.
 */
export function MarathonChallengesNotice({ marathon }: MarathonChallengesNoticeProps) {
  const visible = getPublicVisibleChallenges(marathon);
  const hiddenCount = countHiddenChallenges(marathon);

  return (
    <Section tone="dark" aria-labelledby="marathon-challenges-title">
      <Container className="max-w-3xl">
        <SectionHeader
          eyebrow="Consignas"
          title="Se liberan en el momento definido"
          description="Clickatón no anticipa consignas. Solo muestra las que FotoRank marque como reveladas y liberadas."
          titleId="marathon-challenges-title"
          tone="inverse"
        />

        {visible.length === 0 ? (
          <Card variant="outlined" className="mt-[var(--ck-stack-subtitle-to-content)] border-ck-yellow/40 bg-ck-black text-ck-yellow">
            <p className="ck-heading-md text-ck-yellow">Consignas aún no liberadas</p>
            <p className="ck-body-md mt-4 text-ck-gray-200">
              Cuando comience la maratón (o en el horario definido por las bases), las consignas
              autorizadas aparecerán acá. Mientras tanto permanecen ocultas por seguridad.
            </p>
            {hiddenCount > 0 ? (
              <p className="ck-caption mt-4 text-ck-gray-400">
                Hay consignas programadas en el contrato de datos, pero ninguna es pública todavía.
              </p>
            ) : null}
          </Card>
        ) : (
          <ol className="mt-10 space-y-4">
            {visible.map((challenge) => (
              <li key={challenge.id}>
                <Card variant="outlined" className="border-ck-yellow/40 bg-ck-black text-ck-white">
                  <p className="ck-label text-ck-yellow">Consigna {challenge.order}</p>
                  <h3 className="ck-heading-md mt-2 text-ck-yellow">{challenge.title}</h3>
                  {challenge.description ? (
                    <p className="ck-body-md mt-3 text-ck-gray-200">{challenge.description}</p>
                  ) : null}
                  {challenge.educationalGoal ? (
                    <p className="ck-caption mt-4 text-ck-gray-400">
                      Objetivo pedagógico: {challenge.educationalGoal}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </Section>
  );
}
