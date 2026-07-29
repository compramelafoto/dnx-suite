import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { sobrePageContent } from "@/content/sobre";

const { experience, expo, marathon } = sobrePageContent;

export function AboutExperience() {
  return (
    <>
      <Section
        id="experiencia"
        tone="raised"
        className="scroll-mt-28 py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-experience-title"
      >
        <Container>
          <div className="max-w-3xl">
            <h2 id="sobre-experience-title" className="ck-display-lg text-ck-text">
              {experience.title}
            </h2>
            <p className="ck-body-lg mt-8 text-ck-text-secondary">{experience.lead}</p>
          </div>

          <ol className="relative mt-14 space-y-0 sm:mt-16" aria-label="Etapas de la jornada">
            {experience.steps.map((step, index) => {
              const isLast = index === experience.steps.length - 1;
              return (
                <li
                  key={step.title}
                  className="relative grid gap-4 pb-12 sm:grid-cols-[auto_1fr] sm:gap-10 sm:pb-14"
                >
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
                  </div>
                </li>
              );
            })}
          </ol>

          <p
            className="mt-4 overflow-x-auto border-t border-ck-border pt-10 text-center text-xs uppercase tracking-[0.14em] text-ck-text-muted sm:text-sm"
            style={{ fontFamily: "var(--ck-font-sans)" }}
            aria-hidden
          >
            {experience.steps.map((step) => step.title.toUpperCase()).join(" → ")}
          </p>
        </Container>
      </Section>

      <Section
        tone="base"
        className="py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-expo-title"
      >
        <Container>
          <div className="max-w-3xl">
            <h2 id="sobre-expo-title" className="ck-display-lg text-ck-text">
              {expo.title}
            </h2>
            <div className="mt-10 space-y-6">
              {expo.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <ul className="mt-10 flex flex-wrap gap-2" aria-label="Actividades del espacio previo">
              {expo.highlights.map((item) => (
                <li
                  key={item}
                  className="border border-ck-border px-3 py-1.5 text-sm text-ck-text-secondary"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Section
        tone="raised"
        className="py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-marathon-title"
      >
        <Container>
          <div className="max-w-3xl">
            <h2 id="sobre-marathon-title" className="ck-display-lg text-ck-text">
              {marathon.title}
            </h2>
            <div className="mt-10 space-y-5">
              {marathon.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="ck-body-lg mt-8 font-semibold text-ck-yellow">{marathon.highlight}</p>
            <p className="ck-body-lg mt-6 text-ck-text-secondary">{marathon.closing}</p>
          </div>
        </Container>
      </Section>
    </>
  );
}
