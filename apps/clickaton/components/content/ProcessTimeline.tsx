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
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Card variant="interactive" className="flex h-full flex-col gap-4">
            <IconFrame tone="dark" className="size-10 shrink-0" label={`Paso ${index + 1}`}>
              <span className="font-display text-lg leading-none text-ck-yellow">
                {index + 1}
              </span>
            </IconFrame>
            <div className="min-w-0 space-y-3">
              <h3 className="ck-heading-md">{step.title}</h3>
              <p className="ck-body-sm text-ck-text-secondary">{step.body}</p>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}
