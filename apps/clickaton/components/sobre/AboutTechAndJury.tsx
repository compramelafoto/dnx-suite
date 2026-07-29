import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { sobrePageContent } from "@/content/sobre";

const { technology, jury } = sobrePageContent;

export function AboutTechAndJury() {
  return (
    <>
      <Section
        tone="base"
        className="py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-tech-title"
      >
        <Container>
          <div className="max-w-3xl">
            <h2 id="sobre-tech-title" className="ck-display-lg text-ck-text">
              {technology.title}
            </h2>
            <div className="mt-10 space-y-6">
              {technology.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="ck-body-sm mt-10 max-w-prose border-l-4 border-ck-yellow/60 pl-4 text-ck-text-muted">
              {technology.note}
            </p>
          </div>
        </Container>
      </Section>

      <Section
        tone="raised"
        className="py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-jury-title"
      >
        <Container>
          <div className="max-w-3xl">
            <h2 id="sobre-jury-title" className="ck-display-lg text-ck-text">
              {jury.title}
            </h2>
            <div className="mt-10 space-y-5">
              {jury.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <ul className="mt-8 grid gap-2 sm:grid-cols-2">
              {jury.centralizes.map((item) => (
                <li key={item} className="ck-body-md flex gap-2 text-ck-text">
                  <span className="text-ck-yellow" aria-hidden>
                    •
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 space-y-5">
              {jury.closing.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="ck-body-lg mt-6 font-semibold text-ck-yellow">{jury.highlight}</p>
          </div>
        </Container>
      </Section>
    </>
  );
}
