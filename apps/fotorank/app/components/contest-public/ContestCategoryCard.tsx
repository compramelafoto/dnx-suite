import Link from "next/link";
import {
  resolveCategoryPresentation,
  type PublicCategoryInput,
} from "../../lib/fotorank/contest-public-presentation";
import { ContestInfoBadge } from "./ContestInfoBadge";

type Props = {
  category: PublicCategoryInput;
  index: number;
  inscriptionHref: string;
  inscriptionEnabled: boolean;
};

export function ContestCategoryCard({
  category,
  index,
  inscriptionHref,
  inscriptionEnabled,
}: Props) {
  const sem = resolveCategoryPresentation(category);
  const Icon = sem.icon;
  const num = String(index + 1).padStart(2, "0");

  return (
    <li className="fr-contest-category-card">
      <div className="fr-contest-category-card__top">
        <span className="fr-contest-category-card__num" aria-hidden>
          {num}
        </span>
        <span className="fr-contest-category-card__icon" aria-hidden>
          <Icon width={20} height={20} strokeWidth={1.75} />
        </span>
      </div>

      <h3 className="fr-contest-category-card__title">{category.name}</h3>

      {category.description ? (
        <p className="fr-contest-category-card__desc">{category.description}</p>
      ) : null}

      <ul className="fr-contest-category-card__badges">
        {sem.badges.map((b) => (
          <li key={b.key}>
            <ContestInfoBadge label={b.label} tone={b.tone} icon={b.icon} />
          </li>
        ))}
      </ul>

      {sem.requirementNote ? (
        <p className="fr-contest-category-card__note">{sem.requirementNote}</p>
      ) : null}

      <div className="fr-contest-category-card__actions">
        {inscriptionEnabled ? (
          <Link href={inscriptionHref} className="fr-btn fr-btn-secondary fr-contest-category-card__cta">
            Participar en esta categoría
          </Link>
        ) : (
          <span className="fr-btn fr-btn-secondary fr-contest-category-card__cta" aria-disabled="true">
            Inscripción no disponible
          </span>
        )}
        <a href="#bases" className="fr-contest-category-card__link">
          Consultar bases
        </a>
      </div>
    </li>
  );
}
