import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { about } = organizarSedeContent;

/** Intro breve al evento — primera sección después del hero. */
export function OrganizerAbout() {
  return (
    <Section
      tone="raised"
      className="py-16 sm:py-20 lg:py-24"
      aria-labelledby="organizer-about-title"
    >
      <Container className="max-w-3xl">
        <p className="ck-overline text-ck-yellow">{about.eyebrow}</p>
        <h2 id="organizer-about-title" className="ck-display-lg mt-6 text-ck-text">
          {about.title}
        </h2>
        <p className="ck-body-lg mt-8 text-ck-text-secondary">{about.body}</p>
      </Container>
    </Section>
  );
}
