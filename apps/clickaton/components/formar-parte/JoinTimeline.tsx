import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { formarParteContent } from "@/content/formar-parte";

const { timeline } = formarParteContent;

export function JoinTimeline() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-timeline-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{timeline.eyebrow}</p>
          <h2 id="join-timeline-title" className="ck-display-lg mt-6 text-ck-text">
            {timeline.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{timeline.lead}</p>
        </div>

        <ol className="relative mt-14 space-y-0 sm:mt-16">
          {timeline.steps.map((step, index) => {
            const isLast = index === timeline.steps.length - 1;
            return (
              <li key={step.title} className="relative grid gap-4 pb-12 sm:grid-cols-[auto_1fr] sm:gap-10 sm:pb-14">
                <div className="flex flex-col items-start sm:items-center">
                  <span
                    className="inline-flex size-12 shrink-0 items-center justify-center border border-ck-yellow bg-[var(--ck-brand-primary-soft)] text-sm font-bold text-ck-yellow"
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {!isLast ? (
                    <span
                      className="mt-4 hidden h-full min-h-10 w-px flex-1 bg-gradient-to-b from-ck-yellow/60 to-ck-border sm:block"
                      aria-hidden
                    />
                  ) : null}
                  {!isLast ? (
                    <span
                      className="mt-2 text-ck-yellow sm:hidden"
                      aria-hidden
                    >
                      ↓
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 border-t border-ck-border pt-5 sm:border-t-0 sm:pt-1">
                  <h3
                    className="text-2xl uppercase tracking-wide text-ck-text sm:text-3xl"
                    style={{ fontFamily: "var(--ck-font-display)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="ck-body-md mt-4 max-w-prose text-ck-text-secondary">
                    {step.body}
                  </p>
                  {!isLast ? (
                    <p className="mt-4 hidden text-ck-yellow/80 sm:block" aria-hidden>
                      ↓
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
