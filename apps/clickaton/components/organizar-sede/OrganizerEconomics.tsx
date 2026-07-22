import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { economics } = organizarSedeContent;

export function OrganizerEconomics() {
  return (
    <Section
      tone="raised"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-economics-title"
    >
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div className="max-w-2xl">
            <p className="ck-overline text-ck-yellow">{economics.eyebrow}</p>
            <h2 id="organizer-economics-title" className="ck-display-lg mt-6 text-ck-text">
              {economics.title}
            </h2>
            <p className="ck-body-lg mt-8 text-ck-text-secondary">{economics.lead}</p>
            <ul className="mt-10 space-y-4">
              {economics.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-4 border-l-2 border-ck-yellow/70 pl-5"
                >
                  <span className="ck-body-md text-ck-text">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="flex flex-col justify-center border border-ck-border bg-ck-surface-base/60 p-8 sm:p-10">
            <p className="ck-heading-md text-ck-text">{economics.note}</p>
            <p className="ck-body-sm mt-6 text-ck-text-muted">{economics.disclaimer}</p>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
