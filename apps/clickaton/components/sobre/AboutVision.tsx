import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { PhotoBackdrop } from "@/components/sobre/PhotoBackdrop";
import { sobrePageContent } from "@/content/sobre";

const { vision } = sobrePageContent;

export function AboutVision() {
  return (
    <Section
      id="vision"
      tone="base"
      className="relative overflow-hidden scroll-mt-28 py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-vision-title"
    >
      <PhotoBackdrop src={vision.backdrop} opacity={0.09} objectPosition="center 30%" />
      <Container className="relative z-[2]">
        <div className="max-w-3xl">
          <h2 id="sobre-vision-title" className="ck-display-lg text-ck-text">
            {vision.title}
          </h2>
          <p className="ck-body-lg mt-10 text-ck-text-secondary">{vision.intro}</p>
          <p
            className="mt-6 text-2xl uppercase tracking-wide text-ck-yellow sm:text-3xl"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            {vision.tools.join(" · ")}
          </p>
          <p className="ck-body-lg mt-12 text-ck-text-secondary">{vision.bondsLead}</p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {vision.bonds.map((item) => (
              <li key={item} className="ck-body-md flex gap-2 text-ck-text">
                <span className="text-ck-yellow" aria-hidden>
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-12 space-y-6">
            {vision.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                {paragraph}
              </p>
            ))}
          </div>
          <p className="ck-body-sm mt-10 max-w-prose border-l border-ck-border pl-4 text-ck-text-muted">
            {vision.note}
          </p>
        </div>
      </Container>
    </Section>
  );
}
