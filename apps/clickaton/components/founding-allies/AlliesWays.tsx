import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";

const { ways } = foundingAlliesContent;

export function AlliesWays() {
  return (
    <Section
      tone="raised"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="allies-ways-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{ways.eyebrow}</p>
          <h2 id="allies-ways-title" className="ck-display-lg mt-6 text-ck-text">
            {ways.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{ways.lead}</p>
          <p className="ck-body-md mt-4 max-w-prose text-ck-text-muted">
            {ways.body}
          </p>
        </div>

        <ul className="mt-14 grid gap-6 sm:mt-16 md:grid-cols-2 lg:gap-8">
          {ways.roles.map((role) => (
            <li
              key={role.title}
              className="border border-ck-border bg-ck-surface-base/50 p-8 sm:p-10"
            >
              <h3 className="ck-heading-lg text-ck-text">{role.title}</h3>
              <p className="ck-body-md mt-6 text-ck-text-secondary">{role.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 border-t border-ck-border pt-10">
          <p className="ck-overline text-ck-text-muted">Cada alianza se adapta según</p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {ways.adapts.map((item) => (
              <li
                key={item}
                className="bg-ck-yellow px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ck-text-on-brand)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
