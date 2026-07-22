import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { who } = organizarSedeContent;

export function OrganizerWho() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-who-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{who.eyebrow}</p>
          <h2 id="organizer-who-title" className="ck-display-lg mt-6 text-ck-text">
            {who.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{who.lead}</p>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 lg:gap-6">
          {who.profiles.map((profile) => (
            <li
              key={profile}
              className="flex min-h-[5.5rem] items-center justify-center border border-ck-border bg-ck-surface-base/40 px-4 py-6 text-center transition-[border-color,transform] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:border-ck-yellow/40"
            >
              <span
                className="text-lg uppercase tracking-wide text-ck-text sm:text-xl"
                style={{ fontFamily: "var(--ck-font-display)" }}
              >
                {profile}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
