import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMarathonDateTime } from "@/lib/datetime";
import { getPublicSchedule } from "@/lib/marathons";
import {
  scheduleItemTypeLabels,
  type PublicMarathon,
} from "@/types/marathon";

type MarathonScheduleProps = {
  marathon: PublicMarathon;
};

export function MarathonSchedule({ marathon }: MarathonScheduleProps) {
  const items = getPublicSchedule(marathon);

  return (
    <Section aria-labelledby="marathon-schedule-title">
      <Container>
        <SectionHeader
          eyebrow="Cronograma"
          title="Tiempos públicos de la jornada"
          description="Solo se muestran actividades marcadas como públicas antes del evento. Puntos operativos internos permanecen ocultos."
          titleId="marathon-schedule-title"
        />
        {items.length === 0 ? (
          <p className="ck-body-md mt-8 text-ck-text-muted">
            El cronograma público se publicará con la edición.
          </p>
        ) : (
          <ol className="mt-10 space-y-4">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="grid gap-4 border-2 border-ck-border bg-ck-surface p-5 sm:grid-cols-[auto_1fr] sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center border border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] font-mono text-sm font-bold text-ck-yellow"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Badge variant="neutral">{scheduleItemTypeLabels[item.type]}</Badge>
                </div>
                <div>
                  <h3 className="ck-heading-md">{item.title}</h3>
                  <p className="ck-body-sm mt-2 text-ck-text-muted">
                    {formatMarathonDateTime(item.startAt, marathon.timezone)}
                    {item.endAt
                      ? ` — ${formatMarathonDateTime(item.endAt, marathon.timezone)}`
                      : null}
                    {item.location ? ` · ${item.location}` : null}
                  </p>
                  {item.description ? (
                    <p className="ck-body-md mt-3 max-w-prose text-ck-text-secondary">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </Section>
  );
}
