import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";

const { movement } = foundingAlliesContent;

export function AlliesMovement() {
  return (
    <Section tone="base" className="py-20 sm:py-28 lg:py-36" aria-labelledby="allies-movement-title">
      <Container>
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-24">
          <div className="max-w-2xl">
            <p className="ck-overline text-ck-yellow">{movement.eyebrow}</p>
            <h2
              id="allies-movement-title"
              className="ck-display-lg mt-6 max-w-[12ch] text-ck-text"
            >
              {movement.title}
            </h2>
            <p className="ck-accent-script mt-8 text-2xl text-ck-text-secondary md:text-3xl">
              {movement.lead}
            </p>
            <p className="ck-body-lg mt-10 max-w-prose text-ck-text-secondary">
              {movement.body}
            </p>
          </div>

          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {movement.pillars.map((pillar) => (
              <li
                key={pillar.label}
                className="border-t border-ck-border pt-5"
              >
                <h3 className="ck-heading-sm text-ck-text">{pillar.label}</h3>
                <p className="ck-body-sm mt-3 text-ck-text-muted">{pillar.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
