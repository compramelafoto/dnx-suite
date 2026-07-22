import { AlliesLogoMarquee } from "@/components/formar-parte/AlliesLogoMarquee";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { formarParteContent } from "@/content/formar-parte";

const { allies, hero } = formarParteContent;

export function JoinAllies() {
  return (
    <Section
      tone="raised"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-allies-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{allies.eyebrow}</p>
          <h2 id="join-allies-title" className="ck-display-lg mt-6 text-ck-text">
            {allies.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{allies.lead}</p>
        </div>
      </Container>

      <div className="mt-12 sm:mt-16">
        <AlliesLogoMarquee />
      </div>

      <Container>
        <div className="mt-12 flex flex-col gap-6 border border-ck-border bg-ck-surface-base/40 p-8 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <p className="ck-body-md max-w-xl text-ck-text-secondary">{allies.ctaNote}</p>
          <Button href={hero.cta.href} size="lg" variant="secondary" className="w-full sm:w-auto">
            {hero.cta.label}
          </Button>
        </div>
      </Container>
    </Section>
  );
}
