import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { faq } = organizarSedeContent;

export function OrganizerFaq() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-faq-title"
    >
      <Container className="max-w-3xl">
        <p className="ck-overline text-ck-yellow">{faq.eyebrow}</p>
        <h2 id="organizer-faq-title" className="ck-display-lg mt-6 text-ck-text">
          {faq.title}
        </h2>

        <div className="mt-12 divide-y divide-ck-border border-y border-ck-border sm:mt-14">
          {faq.items.map((item) => (
            <details key={item.question} className="group py-6">
              <summary className="ck-heading-md cursor-pointer list-none marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ck-yellow [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  <span>{item.question}</span>
                  <span
                    aria-hidden
                    className="mt-1 inline-flex size-7 shrink-0 items-center justify-center border border-ck-yellow/60 bg-[var(--ck-brand-primary-soft)] text-sm font-bold text-ck-yellow transition-transform duration-[var(--ck-duration-base)] group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="ck-body-md mt-4 max-w-prose pr-10 text-ck-text-secondary">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
