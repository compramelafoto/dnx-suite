import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { FocusMark } from "@/components/ui/FocusMark";
import { homeContent } from "@/content/home";

export function FinalCta() {
  const { finalCta } = homeContent;

  return (
    <Section
      id={finalCta.id}
      tone="dark"
      className="border-t border-ck-border"
      aria-labelledby="final-cta-title"
    >
      <Container className="max-w-3xl text-center">
        <FocusMark className="mx-auto text-ck-yellow" size="lg" />
        <h2 id="final-cta-title" className="ck-display-md mt-4 text-ck-yellow">
          {finalCta.title}
        </h2>
        <p className="ck-body-lg mx-auto mt-4 max-w-prose text-ck-gray-200">
          {finalCta.body}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href={finalCta.primaryCta.href}>{finalCta.primaryCta.label}</Button>
          <Button href={finalCta.secondaryCta.href} variant="outline" className="border-ck-yellow text-ck-yellow hover:bg-ck-yellow hover:text-ck-black">
            {finalCta.secondaryCta.label}
          </Button>
        </div>
        <p className="ck-caption mt-6 text-ck-gray-500">{finalCta.note}</p>
      </Container>
    </Section>
  );
}
