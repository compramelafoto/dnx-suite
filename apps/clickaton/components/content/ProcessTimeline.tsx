import { Card } from "@/components/ui/Card";
import { IconFrame } from "@/components/ui/IconFrame";

export type TimelineStep = {
  title: string;
  body: string;
};

type ProcessTimelineProps = {
  steps: readonly TimelineStep[];
};

export function ProcessTimeline({ steps }: ProcessTimelineProps) {
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Card variant="interactive" className="relative h-full pt-8">
            <IconFrame
              tone="dark"
              className="absolute -top-3 left-5 size-8"
              label={`Paso ${index + 1}`}
            >
              <span className="ck-display text-[0.7rem] text-ck-yellow">
                {index + 1}
              </span>
            </IconFrame>
            <h3 className="ck-heading-md">{step.title}</h3>
            <p className="ck-body-sm mt-3 text-ck-text-secondary">{step.body}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}
