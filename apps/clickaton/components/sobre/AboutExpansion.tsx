import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { PhotoBackdrop } from "@/components/sobre/PhotoBackdrop";
import { sobrePageContent } from "@/content/sobre";

const { expansion } = sobrePageContent;

function renderWithBold(text: string, boldParts: readonly string[]) {
  if (boldParts.length === 0) {
    return text;
  }

  const parts: Array<{ text: string; bold: boolean }> = [];
  let remaining = text;

  for (const bold of boldParts) {
    const index = remaining.indexOf(bold);
    if (index === -1) continue;
    if (index > 0) {
      parts.push({ text: remaining.slice(0, index), bold: false });
    }
    parts.push({ text: bold, bold: true });
    remaining = remaining.slice(index + bold.length);
  }

  if (remaining) {
    parts.push({ text: remaining, bold: false });
  }

  if (parts.length === 0) {
    return text;
  }

  return parts.map((part, index) =>
    part.bold ? (
      <strong key={`${part.text}-${index}`} className="font-semibold text-ck-text">
        {part.text}
      </strong>
    ) : (
      <span key={`${part.text.slice(0, 12)}-${index}`}>{part.text}</span>
    ),
  );
}

export function AboutExpansion() {
  const { federal, international } = expansion;

  return (
    <>
      <Section
        id="expansion"
        tone="raised"
        className="relative overflow-hidden scroll-mt-28 py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-expansion-title"
      >
        <PhotoBackdrop src={expansion.backdrop} opacity={0.14} blur={false} />
        <Container className="relative z-[2]">
          <div className="max-w-3xl">
            <h2 id="sobre-expansion-title" className="ck-display-lg text-ck-text">
              {expansion.title}
            </h2>
            <div className="mt-10 space-y-6">
              {expansion.paragraphs.map((paragraph) => (
                <p key={paragraph.text.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {renderWithBold(paragraph.text, paragraph.bold)}
                </p>
              ))}
            </div>
            <p className="ck-body-lg mt-10 text-ck-text-secondary">{expansion.discoverLead}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {expansion.discover.map((item) => (
                <li
                  key={item}
                  className="border border-ck-border bg-ck-surface-base/60 px-3 py-1.5 text-sm uppercase tracking-wide text-ck-text"
                  style={{ fontFamily: "var(--ck-font-sans)" }}
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="ck-body-lg mt-10 text-ck-text-secondary">{expansion.closing}</p>
          </div>

          <div className="mt-20 max-w-3xl border-t border-ck-border pt-16 sm:mt-24 sm:pt-20">
            <h3
              id="sobre-federal-title"
              className="ck-display-md text-ck-text"
            >
              {federal.title}
            </h3>
            <div className="mt-8 space-y-5">
              {federal.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {federal.alliances.map((item) => (
                <li key={item} className="ck-body-md flex gap-2 text-ck-text">
                  <span className="text-ck-yellow" aria-hidden>
                    •
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="ck-body-lg mt-8 text-ck-text-secondary">{federal.closing}</p>
          </div>
        </Container>
      </Section>

      <Section
        tone="base"
        className="py-20 sm:py-28 lg:py-36"
        aria-labelledby="sobre-international-title"
      >
        <Container>
          <div className="max-w-3xl">
            <h2 id="sobre-international-title" className="ck-display-lg text-ck-text">
              {international.title}
            </h2>
            <div className="mt-10 space-y-5">
              {international.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="ck-body-lg mt-8 font-semibold text-ck-yellow">
              {international.highlight}
            </p>
            <div className="mt-8 space-y-5">
              {international.body.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="ck-body-lg mt-6 font-semibold text-ck-text">
              {international.essence}
            </p>
          </div>

          <div className="mt-16 overflow-x-auto border border-ck-yellow/40 bg-[var(--ck-brand-primary-soft)] px-4 py-8 sm:mt-20 sm:px-8">
            <p className="ck-caption text-center text-ck-text-muted">
              {international.trajectoryNote}
            </p>
            <p
              className="mt-5 text-center text-[clamp(1.15rem,3.5vw,2rem)] uppercase tracking-[0.08em] text-ck-yellow"
              style={{ fontFamily: "var(--ck-font-display)" }}
              aria-label={international.trajectory.join(" a ")}
            >
              {international.trajectory.join(" → ")}
            </p>
          </div>

          <p
            className="mt-12 max-w-3xl text-2xl uppercase tracking-wide text-ck-text sm:text-3xl"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            {international.remate}
          </p>
        </Container>
      </Section>
    </>
  );
}
