import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { needs } = organizarSedeContent;

export function OrganizerNeeds() {
  return (
    <Section
      tone="raised"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-needs-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{needs.eyebrow}</p>
          <h2 id="organizer-needs-title" className="ck-display-lg mt-6 text-ck-text">
            {needs.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{needs.lead}</p>
        </div>

        <ol className="mt-14 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {needs.items.map((item, index) => (
            <li
              key={item.title}
              className="border border-ck-border bg-ck-surface-base/50 p-8 sm:p-10"
            >
              <span
                className="inline-flex size-12 items-center justify-center border border-ck-yellow bg-[var(--ck-brand-primary-soft)] text-sm font-bold text-ck-yellow"
                aria-hidden
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3
                className="mt-6 text-2xl uppercase tracking-wide text-ck-text sm:text-3xl"
                style={{ fontFamily: "var(--ck-font-display)" }}
              >
                {item.title}
              </h3>
              <p className="ck-body-md mt-4 text-ck-text-secondary">{item.body}</p>
            </li>
          ))}
        </ol>

        <p
          className="mt-12 max-w-3xl border border-ck-yellow/40 bg-[var(--ck-brand-primary-soft)] px-6 py-5 text-lg text-ck-yellow sm:mt-14 sm:px-8 sm:py-6 sm:text-xl"
          style={{ fontFamily: "var(--ck-font-display)" }}
        >
          {needs.highlight}
        </p>
      </Container>
    </Section>
  );
}
