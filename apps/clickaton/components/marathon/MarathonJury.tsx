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
          description="Solo se publican perfiles aprobados. La evaluación artística se realiza con criterios del concurso; la identidad de cada fotógrafo se mantiene oculta durante la revisión."
          titleId="marathon-jury-title"
        />
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ck-text-muted">
          La admisión técnica verifica requisitos de archivo y participación. El jurado evalúa la
          obra según los criterios definidos para el concurso.
        </p>
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
