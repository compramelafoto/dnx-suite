import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMarathonDateTime } from "@/lib/datetime";
import type { PublicTimelineMilestoneDto } from "@/lib/timeline/types";

type Props = {
  timezone: string;
  milestones: PublicTimelineMilestoneDto[];
  serverNow?: string | null;
};

export function MarathonTimelineMilestones({ timezone, milestones, serverNow }: Props) {
  if (milestones.length === 0) return null;

  return (
    <Section aria-labelledby="marathon-timeline-milestones-title">
      <Container>
        <SectionHeader
          eyebrow="Cronograma oficial"
          title="Hitos públicos de la edición"
          description="Sin contenido secreto de consignas. Si un horario no está configurado, se muestra como pendiente."
          titleId="marathon-timeline-milestones-title"
        />
        {serverNow ? (
          <p className="mt-4 text-xs text-ck-text-muted">
            Reloj del servidor: <span className="font-mono">{serverNow}</span>
          </p>
        ) : null}
        <ol className="mt-10 space-y-4">
          {milestones.map((item, index) => (
            <li
              key={`${item.eventType}-${index}`}
              className="grid gap-4 border-2 border-ck-border bg-ck-surface p-5 sm:grid-cols-[auto_1fr] sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 shrink-0 items-center justify-center border border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] font-mono text-sm font-bold text-ck-yellow"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Badge variant="neutral">{item.status.replaceAll("_", " ")}</Badge>
              </div>
              <div>
                <h3 className="ck-heading-md">{item.name}</h3>
                <p className="ck-body-sm mt-2 text-ck-text-muted">
                  {item.startsAt
                    ? formatMarathonDateTime(item.startsAt, timezone)
                    : "Horario a confirmar"}
                  {item.endsAt
                    ? ` — ${formatMarathonDateTime(item.endsAt, timezone)}`
                    : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
