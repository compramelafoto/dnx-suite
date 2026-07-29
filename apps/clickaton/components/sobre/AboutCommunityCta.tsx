import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { sobrePageContent } from "@/content/sobre";

const { community } = sobrePageContent;

export function AboutCommunityCta() {
  return (
    <Section
      id="comunidad"
      tone="raised"
      className="scroll-mt-28 py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-community-title"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="sobre-community-title" className="ck-display-lg text-ck-text">
            {community.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{community.body}</p>
          <p className="mt-6 text-lg font-semibold text-ck-yellow">
            {community.instagram.handle}
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:mt-12 sm:flex-row sm:items-center sm:flex-wrap">
            <Button
              href={community.instagram.href}
              size="lg"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full uppercase sm:w-auto"
            >
              {community.ctaLabel}
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {community.secondary.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="ck-body-sm font-semibold text-ck-text-secondary underline-offset-4 transition-colors hover:text-ck-yellow hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
