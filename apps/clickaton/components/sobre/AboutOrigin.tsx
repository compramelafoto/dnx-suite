import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { sobrePageContent } from "@/content/sobre";

const { origin } = sobrePageContent;

export function AboutOrigin() {
  return (
    <Section
      id="origen"
      tone="raised"
      className="scroll-mt-28 py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-origin-title"
    >
      <Container>
        <div className="max-w-3xl">
          <h2 id="sobre-origin-title" className="ck-display-lg text-ck-text">
            {origin.title}
          </h2>
          <p className="ck-body-lg mt-10 text-ck-text-secondary">{origin.intro}</p>
          <ul className="mt-8 flex flex-wrap gap-3" aria-label="Mundos que conforman Clickatón">
            {origin.pillars.map((pillar) => (
              <li
                key={pillar}
                className="border border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-ck-yellow"
                style={{ fontFamily: "var(--ck-font-sans)" }}
              >
                {pillar}
              </li>
            ))}
          </ul>
          <div className="mt-10 space-y-6">
            {origin.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {origin.actions.map((action) => (
              <li
                key={action}
                className="flex items-center gap-3 border-b border-ck-border pb-3 text-ck-text"
              >
                <span className="text-ck-yellow" aria-hidden>
                  →
                </span>
                <span className="ck-body-md capitalize text-ck-text">{action}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 space-y-6">
            {origin.closing.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
