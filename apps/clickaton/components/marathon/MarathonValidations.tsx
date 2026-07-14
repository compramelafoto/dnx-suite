import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { PublicMarathon } from "@/types/marathon";

type MarathonValidationsProps = {
  marathon: PublicMarathon;
};

export function MarathonValidations({ marathon }: MarathonValidationsProps) {
  const policy = marathon.validationPolicy;
  if (!policy) return null;

  const flags = [
    {
      label: "Ventana de tiempo",
      active: policy.timeWindowEnforced,
      yes: "Controlada",
      no: "No aplicada",
    },
    {
      label: "GPS",
      active: policy.gpsMayBeRequired,
      yes: "Puede requerirse",
      no: "No previsto",
    },
    {
      label: "EXIF",
      active: policy.exifMayBeRequired,
      yes: "Puede requerirse",
      no: "No previsto",
    },
  ];

  return (
    <Section tone="muted" aria-labelledby="marathon-validations-title">
      <Container>
        <SectionHeader
          eyebrow="Validaciones"
          title="Tiempo, recorrido y metadatos"
          description={policy.summary}
          titleId="marathon-validations-title"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {flags.map((flag) => (
            <Card key={flag.label}>
              <p className="ck-label text-ck-text-muted">{flag.label}</p>
              <div className="mt-3">
                <Badge variant={flag.active ? "accent" : "neutral"}>
                  {flag.active ? flag.yes : flag.no}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
        {policy.notes && policy.notes.length > 0 ? (
          <ul className="mt-8 max-w-3xl list-disc space-y-2 pl-5">
            {policy.notes.map((note) => (
              <li key={note} className="ck-body-sm text-ck-text-secondary">
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </Section>
  );
}
