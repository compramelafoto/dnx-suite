import { BrushStroke } from "@/components/brand/BrushStroke";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { homeContent } from "@/content/home";

const highlights = [
  "Todos los niveles",
  "Equipos diversos",
  "Mirada pedagógica",
  "Desafío creativo",
] as const;

export function Community() {
  const { community } = homeContent;

  return (
    <Section id={community.id} tone="muted" aria-labelledby="community-title">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="accent">Comunidad</Badge>
            <Badge variant="brand">Aprendizaje</Badge>
          </div>
          <SectionHeader
            title={community.title}
            titleId="community-title"
            description={community.lead}
          />
          <BrushStroke className="mt-4" />
          <p className="ck-body-md mt-4 max-w-prose text-ck-text-secondary">{community.body}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {highlights.map((item) => (
            <Card key={item} variant="yellow" className="text-center">
              <p className="ck-heading-md">{item}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
