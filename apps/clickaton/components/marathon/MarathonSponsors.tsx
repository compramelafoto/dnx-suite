import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { PublicMarathon } from "@/types/marathon";

type MarathonSponsorsProps = {
  marathon: PublicMarathon;
};

export function MarathonSponsors({ marathon }: MarathonSponsorsProps) {
  if (marathon.sponsors.length === 0) return null;

  return (
    <Section aria-labelledby="marathon-sponsors-title">
      <Container>
        <SectionHeader
          eyebrow="Patrocinadores"
          title="Alianzas de la edición"
          description="Solo se listan sponsors confirmados. Esta demo usa nombres ficticios marcados como ejemplo."
          titleId="marathon-sponsors-title"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {marathon.sponsors.map((sponsor) => (
            <Card key={sponsor.id} variant="outlined" className="h-full">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="ck-heading-md">{sponsor.name}</h3>
                <Badge variant="neutral">
                  {sponsor.localOrGlobal === "local" ? "Local" : "Global"}
                </Badge>
              </div>
              {sponsor.level ? (
                <p className="ck-label mt-3 text-ck-text-muted">{sponsor.level}</p>
              ) : null}
              {sponsor.description ? (
                <p className="ck-body-sm mt-3 text-ck-text-secondary">{sponsor.description}</p>
              ) : null}
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
