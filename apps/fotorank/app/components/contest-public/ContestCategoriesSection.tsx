import { Layers } from "lucide-react";
import type { PublicCategoryInput } from "../../lib/fotorank/contest-public-presentation";
import { ContestCategoryCard } from "./ContestCategoryCard";
import { ContentContainer, PageSection, SectionHeading } from "./primitives";

type Props = {
  categories: PublicCategoryInput[];
  inscriptionHref: string;
  inscriptionEnabled: boolean;
};

export function ContestCategoriesSection({
  categories,
  inscriptionHref,
  inscriptionEnabled,
}: Props) {
  if (categories.length === 0) return null;

  return (
    <PageSection id="categorias">
      <ContentContainer>
        <SectionHeading
          icon={Layers}
          title="Categorías"
          description="Elegí una categoría al inscribirte. Las reglas particulares están en las bases."
        />
        <ol
          className={[
            "fr-contest-category-cards",
            categories.length === 1 && "fr-contest-category-cards--single",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {categories.map((c, index) => (
            <ContestCategoryCard
              key={c.id}
              category={c}
              index={index}
              inscriptionHref={inscriptionHref}
              inscriptionEnabled={inscriptionEnabled}
            />
          ))}
        </ol>
      </ContentContainer>
    </PageSection>
  );
}
