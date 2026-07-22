import { JoinIcon } from "@/components/formar-parte/JoinIcons";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { IconFrame } from "@/components/ui/IconFrame";
import { formarParteContent } from "@/content/formar-parte";

const { why } = formarParteContent;

export function JoinWhy() {
  return (
    <Section
      tone="raised"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-why-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{why.eyebrow}</p>
          <h2 id="join-why-title" className="ck-display-lg mt-6 text-ck-text">
            {why.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{why.lead}</p>
        </div>

        <ul className="mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {why.cards.map((card) => (
            <li
              key={card.title}
              className="flex flex-col border border-ck-border bg-ck-surface-base/50 p-8 transition-[border-color,transform] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:border-ck-yellow/40 sm:p-10"
            >
              <IconFrame tone="yellow" label={card.title}>
                <JoinIcon name={card.icon} />
              </IconFrame>
              <h3 className="ck-heading-md mt-8 text-ck-text">{card.title}</h3>
              <p className="ck-body-md mt-4 text-ck-text-secondary">{card.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
