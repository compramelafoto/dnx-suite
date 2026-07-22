import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { formarParteContent } from "@/content/formar-parte";

const { touchpoints } = formarParteContent;

export function JoinTouchpoints() {
  return (
    <Section
      tone="base"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-touchpoints-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{touchpoints.eyebrow}</p>
          <h2
            id="join-touchpoints-title"
            className="ck-display-lg mt-6 max-w-[18ch] text-ck-text"
          >
            {touchpoints.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{touchpoints.lead}</p>
        </div>

        <ol className="mt-14 flex flex-col items-stretch gap-0 sm:mt-16">
          {touchpoints.steps.map((step, index) => {
            const isLast = index === touchpoints.steps.length - 1;
            return (
              <li key={step} className="flex flex-col items-center">
                <div className="flex w-full max-w-xl items-center justify-center border border-ck-border bg-ck-surface-base/60 px-6 py-5 text-center transition-colors duration-[var(--ck-duration-base)] hover:border-ck-yellow/40">
                  <span
                    className="text-xl uppercase tracking-[0.12em] text-ck-text sm:text-2xl"
                    style={{ fontFamily: "var(--ck-font-display)" }}
                  >
                    {step}
                  </span>
                </div>
                {!isLast ? (
                  <span
                    className="py-3 text-lg text-ck-yellow"
                    aria-hidden
                  >
                    ↓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mx-auto mt-16 max-w-3xl border-t border-ck-yellow/40 pt-12 text-center sm:mt-20">
          <p
            className="text-[clamp(1.75rem,5vw,3.5rem)] font-normal uppercase leading-[1.05] tracking-[0.02em] text-ck-text"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            <span className="block">{touchpoints.highlight.line1}</span>
            <span className="mt-3 block text-ck-yellow">
              {touchpoints.highlight.line2}
            </span>
          </p>
        </div>
      </Container>
    </Section>
  );
}
