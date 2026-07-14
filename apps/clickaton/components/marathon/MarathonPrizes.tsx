import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import type { PublicMarathon } from "@/types/marathon";

type MarathonPrizesProps = {
  marathon: PublicMarathon;
};

export function MarathonPrizes({ marathon }: MarathonPrizesProps) {
  if (marathon.prizes.length === 0) return null;

  const categoryName = (categoryId?: string) =>
    marathon.categories.find((c) => c.id === categoryId)?.name;

  return (
    <Section aria-labelledby="marathon-prizes-title">
      <Container>
        <SectionHeader
          eyebrow="Premios"
          title="Reconocimientos de la edición"
          description="Los premios publicados acá son públicos y confirmados. Esta demo usa textos conceptuales sin valores inventados."
          titleId="marathon-prizes-title"
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {marathon.prizes.map((prize) => (
            <Card key={prize.id} variant="yellow" className="h-full">
              {typeof prize.position === "number" && prize.position > 0 ? (
                <p className="ck-label text-ck-black/70">Puesto {prize.position}</p>
              ) : (
                <p className="ck-label text-ck-black/70">Mención</p>
              )}
              <h3 className="ck-heading-md mt-3">{prize.title}</h3>
              <p className="ck-body-sm mt-3 text-ck-gray-700">{prize.description}</p>
              {prize.categoryId ? (
                <p className="ck-caption mt-4 text-ck-black/70">
                  Categoría: {categoryName(prize.categoryId) ?? prize.categoryId}
                </p>
              ) : null}
              {prize.sponsorName ? (
                <p className="ck-caption mt-2 text-ck-black/70">
                  Con el apoyo de {prize.sponsorName}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
