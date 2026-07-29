import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { sobrePageContent } from "@/content/sobre";

const { closing } = sobrePageContent;

export function AboutClosing() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-closing-title"
    >
      <Container>
        <div className="max-w-3xl">
          <h2 id="sobre-closing-title" className="ck-display-lg text-ck-text">
            {closing.title}
          </h2>
          <div className="mt-10 space-y-5">
            {closing.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="mt-14 space-y-4 border-l-4 border-ck-yellow pl-6 sm:pl-8">
            {closing.highlights.map((line) => (
              <p key={line} className="ck-body-lg font-semibold text-ck-text">
                {line}
              </p>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
