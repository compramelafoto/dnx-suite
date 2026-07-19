import { ConceptualNote } from "@/components/founding-allies/ConceptualNote";
import { MagazineImage } from "@/components/founding-allies/MagazineImage";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";
import { cn } from "@/lib/cn";

const { merch, conceptualNote } = foundingAlliesContent;

export function AlliesMerch() {
  return (
    <Section
      tone="raised"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="allies-merch-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{merch.eyebrow}</p>
          <h2 id="allies-merch-title" className="ck-display-lg mt-6 text-ck-text">
            {merch.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{merch.lead}</p>
          <ConceptualNote className="mt-6">{conceptualNote}</ConceptualNote>
        </div>

        <ul className="mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {merch.items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "group",
                item.span === "wide" && "sm:col-span-2 lg:col-span-2",
              )}
            >
              <MagazineImage
                src={item.src}
                alt={item.alt}
                aspect={item.span === "wide" ? "landscape" : "portrait"}
                sizes={
                  item.span === "wide"
                    ? "(max-width: 1024px) 100vw, 66vw"
                    : "(max-width: 768px) 100vw, 33vw"
                }
                className="transition-transform duration-500 ease-out group-hover:scale-[1.01]"
              />
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <h3 className="ck-heading-sm text-ck-text">{item.title}</h3>
                <span className="ck-caption text-ck-text-muted">Conceptual</span>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
