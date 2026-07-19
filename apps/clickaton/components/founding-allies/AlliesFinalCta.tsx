import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { foundingAlliesContent } from "@/content/founding-allies";

const { final } = foundingAlliesContent;

export function AlliesFinalCta() {
  return (
    <Section
      tone="raised"
      grain
      className="border-t border-ck-border py-24 sm:py-32 lg:py-40"
      aria-labelledby="allies-final-title"
    >
      <Container>
        <div className="mx-auto max-w-5xl text-center">
          <h2
            id="allies-final-title"
            className="text-[clamp(2.25rem,7vw,5.5rem)] font-normal uppercase leading-[0.95] tracking-[0.02em] text-ck-text"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            {final.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="ck-accent-script mt-10 text-2xl text-ck-text-secondary sm:text-3xl">
            {final.script}
          </p>
          <div className="mt-14 flex justify-center sm:mt-16">
            <Button href={final.cta.href} size="lg">
              {final.cta.label}
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
