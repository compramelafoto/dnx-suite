import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { FocusMark } from "@/components/ui/FocusMark";
import { homeContent } from "@/content/home";
import { siteConfig } from "@/config/site";

export function FinalCta() {
  const { finalCta } = homeContent;

  return (
    <Section
      id={finalCta.id}
      tone="dark"
      className="border-t-2 border-ck-yellow"
      aria-labelledby="final-cta-title"
    >
      <Container className="max-w-3xl text-center">
        <FocusMark className="mx-auto text-ck-yellow" size="lg" />
        <p className="ck-overline mt-[var(--ck-stack-title-to-subtitle)] text-ck-yellow">
          {siteConfig.descriptor}
        </p>
        <h2
          id="final-cta-title"
          className="ck-display-md mt-[var(--ck-stack-title-to-subtitle)] text-ck-yellow"
        >
          {finalCta.title}
        </h2>
        <p className="ck-accent-script mt-4 text-2xl text-ck-yellow/90 md:text-3xl">
          {siteConfig.editorialLine}
        </p>
        <p className="ck-body-lg mx-auto mt-[var(--ck-stack-subtitle-to-content)] max-w-prose text-ck-gray-200">
          {finalCta.body}
        </p>
        <div className="mt-[var(--ck-stack-content-to-actions)] flex flex-wrap justify-center gap-3">
          <Button href={finalCta.primaryCta.href}>{finalCta.primaryCta.label}</Button>
          <Button
            href={finalCta.secondaryCta.href}
            variant="outline"
            className="border-ck-yellow text-ck-yellow hover:bg-ck-yellow hover:text-ck-black"
          >
            {finalCta.secondaryCta.label}
          </Button>
        </div>
        <p className="ck-caption mt-6 text-ck-gray-500">{finalCta.note}</p>
      </Container>
    </Section>
  );
}
