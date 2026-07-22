import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { formarParteContent } from "@/content/formar-parte";

const { ecosystem } = formarParteContent;

export function JoinEcosystem() {
  return (
    <Section
      tone="raised"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-ecosystem-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{ecosystem.eyebrow}</p>
          <h2 id="join-ecosystem-title" className="ck-display-lg mt-6 text-ck-text">
            {ecosystem.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{ecosystem.lead}</p>
          <p className="ck-body-md mt-4 max-w-prose text-ck-text-muted">
            {ecosystem.body}
          </p>
        </div>

        <ul
          className="mt-10 flex flex-wrap gap-3 sm:mt-12"
          aria-label="Familia de plataformas"
        >
          {ecosystem.platforms.map((platform) => (
            <li
              key={platform.name}
              className="border border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-ck-yellow"
            >
              {platform.name}
            </li>
          ))}
        </ul>

        <ul className="mt-12 grid gap-6 sm:mt-14 sm:grid-cols-2 lg:gap-8">
          {ecosystem.platforms.map((platform) => (
            <li
              key={platform.name}
              className="flex flex-col border border-ck-border bg-ck-surface-base/50 p-8 transition-[border-color] duration-[var(--ck-duration-base)] hover:border-ck-yellow/40 sm:p-10"
            >
              <p className="ck-overline text-ck-text-muted">{platform.role}</p>
              <h3
                className="mt-4 text-3xl uppercase tracking-wide text-ck-text sm:text-4xl"
                style={{ fontFamily: "var(--ck-font-display)" }}
              >
                {platform.name}
              </h3>
              <p className="ck-body-md mt-6 text-ck-text-secondary">{platform.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
