import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import {
  allowedDeviceLabels,
  type PublicMarathon,
} from "@/types/marathon";

type MarathonCategoriesProps = {
  marathon: PublicMarathon;
};

export function MarathonCategories({ marathon }: MarathonCategoriesProps) {
  return (
    <Section tone="muted" aria-labelledby="marathon-categories-title">
      <Container>
        <SectionHeader
          eyebrow="Categorías"
          title="Cómo se organiza la participación"
          description="Cada edición define sus categorías. Los dispositivos admitidos pueden variar por categoría."
          titleId="marathon-categories-title"
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {marathon.categories.map((category) => (
            <Card key={category.id} className="h-full">
              <h3 className="ck-heading-md">{category.name}</h3>
              <p className="ck-body-sm mt-3 text-ck-text-secondary">{category.description}</p>
              <dl className="mt-6 space-y-3">
                <div>
                  <dt className="ck-label text-ck-text-muted">Dispositivos</dt>
                  <dd className="ck-body-sm mt-1">
                    {category.allowedDevices.map((d) => allowedDeviceLabels[d]).join(" · ")}
                  </dd>
                </div>
                {category.ageRange ? (
                  <div>
                    <dt className="ck-label text-ck-text-muted">Edad</dt>
                    <dd className="ck-body-sm mt-1">{category.ageRange}</dd>
                  </div>
                ) : null}
                {typeof category.capacity === "number" ? (
                  <div>
                    <dt className="ck-label text-ck-text-muted">Cupo orientativo</dt>
                    <dd className="ck-body-sm mt-1">{category.capacity} lugares</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
