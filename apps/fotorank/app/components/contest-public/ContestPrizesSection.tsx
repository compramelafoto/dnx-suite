import { Award } from "lucide-react";
import {
  groupPrizesByCategory,
  type ContestPrizePresentation,
} from "../../lib/fotorank/contest-public-presentation";
import { ContestPrizeCard } from "./ContestPrizeCard";
import { ContentContainer, PageSection, SectionHeading, Stack } from "./primitives";

type Props = {
  prizes: ContestPrizePresentation[];
  /** Texto libre legacy; solo si no hay premios estructurados. */
  summaryFallback?: string | null;
};

/**
 * Sección condicional. Si no hay premios públicos ni resumen, no renderiza.
 */
export function ContestPrizesSection({ prizes, summaryFallback }: Props) {
  const hasPrizes = prizes.length > 0;
  const summary = summaryFallback?.trim() || "";
  if (!hasPrizes && !summary) return null;

  const featured = prizes.find((p) => p.featured) ?? null;
  const rest = featured ? prizes.filter((p) => p.id !== featured.id) : prizes;
  const groups = groupPrizesByCategory(rest);

  return (
    <PageSection id="premios" tone="emphasis">
      <ContentContainer>
        <SectionHeading
          icon={Award}
          title="Premios y reconocimientos"
          description={
            hasPrizes
              ? "Premios confirmados para publicación. Las condiciones completas están en las bases."
              : "Resumen publicado por la organización. Detalle completo en las bases."
          }
        />

        {hasPrizes ? (
          <Stack gap="lg">
            {featured ? <ContestPrizeCard prize={featured} featured /> : null}

            {groups.map((group) => (
              <div key={group.categoryId ?? "general"} className="fr-contest-prize-group">
                {groups.length > 1 || group.categoryId ? (
                  <h3 className="fr-contest-prize-group__title">{group.categoryName}</h3>
                ) : null}
                <ul className="fr-contest-prize-grid">
                  {group.prizes.map((p) => (
                    <li key={p.id}>
                      <ContestPrizeCard prize={p} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Stack>
        ) : (
          <div className="fr-contest-prize-summary">
            <p className="fr-type-body whitespace-pre-wrap">{summary}</p>
            <a href="#bases" className="fr-contest-prize-card__rules">
              Consultar condiciones en las bases
            </a>
          </div>
        )}
      </ContentContainer>
    </PageSection>
  );
}
