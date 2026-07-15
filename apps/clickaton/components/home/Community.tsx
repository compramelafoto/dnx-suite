import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { homeContent } from "@/content/home";

export function Community() {
  const { community } = homeContent;

  return (
    <Section id={community.id} tone="raised" aria-labelledby="community-title">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12">
        <div>
          <SectionHeader
            eyebrow={community.eyebrow}
            title={community.title}
            description={community.lead}
            titleId="community-title"
          />
          <ul className="mt-[var(--ck-stack-subtitle-to-content)] flex flex-wrap gap-2">
            {community.roles.map((role) => (
              <li key={role}>
                <Badge variant="accent">{role}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-[var(--ck-stack-content-to-actions)] flex flex-col items-start gap-2">
            <Button href={community.cta.href} variant="secondary">
              {community.cta.label}
            </Button>
            <p className="ck-caption">{community.cta.note}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <PhotoFrame
            variant="portrait"
            alt="Fotógrafa en recorrido urbano"
            overlay="soft"
            className="col-span-1"
          />
          <div className="grid gap-3 sm:gap-4">
            <PhotoFrame
              variant="thumbnail"
              alt="Detalle de cámara en la calle"
              overlay="none"
            />
            <PhotoFrame
              variant="thumbnail"
              alt="Grupo revisando capturas"
              overlay="none"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
