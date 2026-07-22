import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { whatIs } = organizarSedeContent;

export function OrganizerWhatIs() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-what-title"
    >
      <Container>
        <div className="grid items-stretch gap-12 lg:grid-cols-2 lg:gap-20 xl:gap-24">
          <div className="max-w-xl">
            <p className="ck-overline text-ck-yellow">{whatIs.eyebrow}</p>
            <h2
              id="organizer-what-title"
              className="ck-display-lg mt-6 max-w-[14ch] text-ck-text"
            >
              {whatIs.title}
            </h2>
            <div className="mt-10 space-y-6">
              {whatIs.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="ck-body-lg text-ck-text-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="relative min-h-[22rem] overflow-hidden border border-ck-border bg-ck-surface-base/40 lg:min-h-full">
            <Image
              src={whatIs.image.src}
              alt={whatIs.image.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
