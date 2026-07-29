import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { PhotoBackdrop } from "@/components/sobre/PhotoBackdrop";
import { sobrePageContent } from "@/content/sobre";

const { whatIs } = sobrePageContent;

export function AboutWhatIs() {
  return (
    <Section
      id="que-es"
      tone="base"
      className="relative overflow-hidden scroll-mt-28 py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-what-title"
    >
      <PhotoBackdrop src={whatIs.backdrop} opacity={0.1} />
      <Container className="relative z-[2]">
        <div className="max-w-3xl">
          <h2 id="sobre-what-title" className="ck-display-lg text-ck-text">
            {whatIs.title}
          </h2>
          <div className="mt-10 space-y-6">
            {whatIs.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="mt-12 border-l-4 border-ck-yellow pl-6 sm:pl-8">
            <p className="ck-body-md text-ck-text-secondary">{whatIs.highlightLead}</p>
            <p className="ck-body-lg mt-4 font-semibold text-ck-text">{whatIs.highlight}</p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
