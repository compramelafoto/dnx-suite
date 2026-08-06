import {
  formatPrizeAmount,
  prizeTypeIcon,
  type ContestPrizePresentation,
} from "../../lib/fotorank/contest-public-presentation";
import { hasUsableImageUrl } from "../../lib/fotorank/contest-visual";
import { ContestInfoBadge } from "./ContestInfoBadge";

type Props = {
  prize: ContestPrizePresentation;
  featured?: boolean;
};

export function ContestPrizeCard({ prize, featured = false }: Props) {
  const Icon = prizeTypeIcon(prize.type);
  const amountLabel =
    typeof prize.monetaryAmount === "number" && prize.currency
      ? formatPrizeAmount(prize.monetaryAmount, prize.currency)
      : null;

  return (
    <article
      className={[
        "fr-contest-prize-card",
        featured && "fr-contest-prize-card--featured",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="fr-contest-prize-card__head">
        <span className="fr-contest-prize-card__type-icon" aria-hidden>
          <Icon width={18} height={18} strokeWidth={1.75} />
        </span>
        <div className="fr-contest-prize-card__badges">
          {prize.rank ? <ContestInfoBadge label={prize.rank} tone="special" /> : null}
          {prize.scope === "CATEGORY" && prize.categoryName ? (
            <ContestInfoBadge label={prize.categoryName} tone="modality" />
          ) : null}
          {prize.scope === "GENERAL" ? (
            <ContestInfoBadge label="Premio general" tone="modality" />
          ) : null}
        </div>
      </div>

      <h3 className="fr-contest-prize-card__title">{prize.title}</h3>

      {amountLabel ? (
        <p className="fr-contest-prize-card__amount">{amountLabel}</p>
      ) : prize.benefitLabel ? (
        <p className="fr-contest-prize-card__benefit">{prize.benefitLabel}</p>
      ) : null}

      {prize.shortDescription ? (
        <p className="fr-contest-prize-card__desc">{prize.shortDescription}</p>
      ) : null}

      {prize.conditionsSummary ? (
        <p className="fr-contest-prize-card__conditions">{prize.conditionsSummary}</p>
      ) : null}

      {prize.sponsorName ? (
        <div className="fr-contest-prize-card__sponsor">
          <p className="fr-contest-prize-card__sponsor-label">Aportado por</p>
          <div className="fr-contest-prize-card__sponsor-row">
            {prize.sponsorLogoUrl && hasUsableImageUrl(prize.sponsorLogoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prize.sponsorLogoUrl}
                alt={prize.sponsorLogoAlt ?? `Logo de ${prize.sponsorName}`}
                className="fr-contest-prize-card__sponsor-logo"
              />
            ) : null}
            <span className="fr-contest-prize-card__sponsor-name">{prize.sponsorName}</span>
          </div>
        </div>
      ) : null}

      <a href={prize.rulesAnchor ?? "#bases"} className="fr-contest-prize-card__rules">
        Consultar condiciones en las bases
      </a>
    </article>
  );
}
