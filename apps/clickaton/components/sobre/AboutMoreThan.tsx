import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { PhotoBackdrop } from "@/components/sobre/PhotoBackdrop";
import { sobrePageContent } from "@/content/sobre";

const { moreThan } = sobrePageContent;

const affirmations = moreThan.paragraphs.slice(0, 3);
const turningPoint = moreThan.paragraphs[3];
const rest = moreThan.paragraphs.slice(4);

export function AboutMoreThan() {
  return (
    <Section
      tone="base"
      className="relative overflow-hidden py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-more-title"
    >
      <PhotoBackdrop src={moreThan.backdrop} opacity={0.08} />
      <Container className="relative z-[2]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-16 xl:gap-20">
          <div className="max-w-xl">
            <h2 id="sobre-more-title" className="ck-display-lg text-ck-text">
              {moreThan.title}
            </h2>
            <ul className="mt-10 space-y-4 border-l-4 border-ck-yellow pl-6 sm:pl-8">
              {affirmations.map((line) => (
                <li key={line} className="ck-body-lg text-ck-text">
                  {line}
                </li>
              ))}
            </ul>
            <p className="ck-body-lg mt-8 text-ck-text-secondary">{turningPoint}</p>
          </div>

          <div className="max-w-2xl space-y-5 lg:pt-2">
            {rest.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
            <div className="mt-10 border-t border-ck-border pt-8">
              <p className="ck-body-lg font-semibold text-ck-text sm:text-xl">
                {moreThan.highlight}
              </p>
              <p
                className="mt-4 text-3xl uppercase tracking-wide text-ck-yellow sm:text-4xl"
                style={{ fontFamily: "var(--ck-font-display)" }}
              >
                {moreThan.remate}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
