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

        <div className="mt-10 divide-y-2 divide-ck-border border-y-2 border-ck-border">
          {faq.items.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="ck-heading-md cursor-pointer list-none marker:content-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ck-black [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex size-7 shrink-0 items-center justify-center border-2 border-ck-border-strong bg-ck-yellow text-sm font-bold text-ck-black transition-transform group-open:rotate-45"
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
