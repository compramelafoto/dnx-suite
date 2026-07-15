import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { homeContent } from "@/content/home";

export function FAQList() {
  const { faq } = homeContent;

  return (
    <Section id={faq.id} aria-labelledby="faq-title">
      <Container className="max-w-3xl">
        <SectionHeader
          eyebrow={faq.eyebrow}
          title={faq.title}
          titleId="faq-title"
        />

        <div className="mt-10 divide-y divide-ck-border border-y border-ck-border">
          {faq.items.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="ck-heading-md cursor-pointer list-none marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ck-yellow [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
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
