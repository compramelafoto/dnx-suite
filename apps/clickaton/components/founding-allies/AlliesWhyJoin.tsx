import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";

const { whyJoin } = foundingAlliesContent;

export function AlliesWhyJoin() {
  return (
    <Section
      tone="raised"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="allies-why-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{whyJoin.eyebrow}</p>
          <h2 id="allies-why-title" className="ck-display-lg mt-6 text-ck-text">
            {whyJoin.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{whyJoin.lead}</p>
          <p className="ck-body-md mt-4 max-w-prose text-ck-text-muted">
            {whyJoin.body}
          </p>
        </div>

        <p className="ck-overline mt-16 text-ck-text-muted sm:mt-20">
          Tu empresa puede hacer posible
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {whyJoin.experiences.map((item) => (
            <li
              key={item}
              className="flex min-h-24 items-end border border-ck-border bg-ck-surface-base/60 px-5 py-5 transition-colors duration-300 hover:border-ck-yellow/50"
            >
              <span
                className="text-2xl uppercase leading-none tracking-wide text-ck-text sm:text-3xl"
                style={{ fontFamily: "var(--ck-font-display)" }}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
