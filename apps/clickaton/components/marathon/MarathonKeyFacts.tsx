import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import {
  allowedDeviceLabels,
  type PublicMarathon,
} from "@/types/marathon";

type MarathonKeyFactsProps = {
  marathon: PublicMarathon;
};

export function MarathonKeyFacts({ marathon }: MarathonKeyFactsProps) {
  const facts = [
    {
      label: "Dispositivos",
      value: marathon.allowedDevices.map((d) => allowedDeviceLabels[d]).join(" · "),
    },
    {
      label: "Cupo",
      value: marathon.participantLimit
        ? `Hasta ${marathon.participantLimit} participantes`
        : "Sin cupo publicado",
    },
    {
      label: "Edad mínima",
      value: marathon.minimumAge ? `${marathon.minimumAge} años` : "Según bases",
    },
    {
      label: "Punto de encuentro",
      value: marathon.meetingPoint ?? marathon.venueName ?? "Se publicará con la edición",
    },
  ];

  return (
    <Section tone="muted" aria-labelledby="marathon-facts-title">
      <Container>
        <h2 id="marathon-facts-title" className="ck-display-md">
          Datos de la edición
        </h2>
        <p className="ck-body-md mt-4 max-w-prose text-ck-text-secondary">
          {marathon.fullDescription}
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <Card key={fact.label} className="h-full">
              <p className="ck-label text-ck-text-muted">{fact.label}</p>
              <p className="ck-heading-md mt-3 text-balance">{fact.value}</p>
            </Card>
          ))}
        </div>
        {marathon.accessibilityNotes ? (
          <p className="ck-body-sm mt-8 max-w-prose border-l-4 border-ck-yellow pl-4 text-ck-text-muted">
            {marathon.accessibilityNotes}
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
