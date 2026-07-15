import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import type { PublicMarathon } from "@/types/marathon";

type MarathonJuryProps = {
  marathon: PublicMarathon;
};

export function MarathonJury({ marathon }: MarathonJuryProps) {
  if (marathon.jury.length === 0) return null;

  return (
    <Section tone="raised" aria-labelledby="marathon-jury-title">
      <Container>
        <SectionHeader
          eyebrow="Jurado"
          title="Quiénes acompañan la evaluación"
          description="Solo se publican perfiles aprobados. Los criterios internos no publicados no aparecen en esta ficha."
          titleId="marathon-jury-title"
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {marathon.jury.map((member) => (
            <Card key={member.id} className="h-full">
              <div className="mb-5 w-24">
                <PhotoFrame
                  variant="jury"
                  src={member.portrait}
                  alt={member.portrait ? `Retrato de ${member.name}` : ""}
                  decorative={!member.portrait}
                  overlay="none"
                />
              </div>
              <h3 className="ck-heading-md">{member.name}</h3>
              <p className="ck-label mt-2 text-ck-text-muted">{member.role}</p>
              {member.biography ? (
                <p className="ck-body-sm mt-4 text-ck-text-secondary">{member.biography}</p>
              ) : null}
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
