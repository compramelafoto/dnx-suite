import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";

const { vision } = foundingAlliesContent;

export function AlliesVision() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="allies-vision-title"
    >
      <Container>
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-24">
          <div className="max-w-xl">
            <p className="ck-overline text-ck-yellow">{vision.eyebrow}</p>
            <h2 id="allies-vision-title" className="ck-display-lg mt-6 text-ck-text">
              {vision.title}
            </h2>
            <p className="ck-accent-script mt-8 text-2xl text-ck-text-secondary md:text-3xl">
              {vision.lead}
            </p>
            <p className="ck-body-lg mt-8 text-ck-text-secondary">{vision.body}</p>
          </div>

          <ol className="space-y-0 border-t border-ck-border">
            {vision.points.map((point, index) => (
              <li
                key={point.title}
                className="grid grid-cols-[auto_1fr] gap-6 border-b border-ck-border py-6 sm:gap-10 sm:py-8"
              >
                <span className="ck-caption pt-1 text-ck-yellow">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="ck-heading-md text-ck-text">{point.title}</h3>
                  <p className="ck-body-sm mt-2 text-ck-text-muted">{point.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
