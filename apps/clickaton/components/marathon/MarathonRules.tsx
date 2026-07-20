import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import type { PublicMarathon } from "@/types/marathon";

type MarathonRulesProps = {
  marathon: PublicMarathon;
};

export function MarathonRules({ marathon }: MarathonRulesProps) {
  const rules = marathon.rules;
  if (!rules) return null;

  const paragraphs = rules.content?.split("\n").filter(Boolean) ?? [];

  return (
    <Section id="bases" aria-labelledby="marathon-rules-title">
      <Container className="max-w-3xl">
        <SectionHeader
          eyebrow="Bases"
          title={rules.title}
          description={rules.summary}
          titleId="marathon-rules-title"
        />
        <Card className="mt-10" variant="outlined">
          <p className="ck-label text-ck-text-muted">Versión {rules.version}</p>
          {paragraphs.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {paragraphs.map((line) => (
                <li key={line} className="ck-body-md text-ck-text-secondary">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {rules.documentUrl ? (
            <p className="ck-body-sm mt-6">
              <a
                href={rules.documentUrl}
                className="font-semibold underline-offset-4 hover:underline"
              >
                Descargar bases (PDF)
              </a>
            </p>
          ) : (
            <p className="ck-caption mt-6 text-ck-text-muted">
              En ediciones reales podrá publicarse un documento descargable. Esta demo no incluye PDF.
            </p>
          )}
        </Card>
      </Container>
    </Section>
  );
}
