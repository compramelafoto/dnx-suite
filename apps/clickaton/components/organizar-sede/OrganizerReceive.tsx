import { OrganizerIcon } from "@/components/organizar-sede/OrganizerIcons";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { IconFrame } from "@/components/ui/IconFrame";
import { organizarSedeContent } from "@/content/organizar-sede";

const { receive } = organizarSedeContent;

export function OrganizerReceive() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-receive-title"
    >
      <Container width="wide">
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{receive.eyebrow}</p>
          <h2 id="organizer-receive-title" className="ck-display-lg mt-6 text-ck-text">
            {receive.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{receive.lead}</p>
        </div>

        <ul className="mt-14 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6">
          {receive.cards.map((card) => (
            <li
              key={card.title}
              className="flex flex-col border border-ck-border bg-ck-surface-base/50 p-7 transition-[border-color,transform] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:border-ck-yellow/40 sm:p-8"
            >
              <IconFrame tone="outline" label={card.title}>
                <OrganizerIcon name={card.icon} />
              </IconFrame>
              <h3 className="ck-heading-md mt-6 text-ck-text">{card.title}</h3>
              <p className="ck-body-sm mt-3 text-ck-text-secondary">{card.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
