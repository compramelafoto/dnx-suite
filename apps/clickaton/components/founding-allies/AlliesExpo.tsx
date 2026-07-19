import { ConceptualNote } from "@/components/founding-allies/ConceptualNote";
import { MagazineImage } from "@/components/founding-allies/MagazineImage";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";

const { expo, conceptualNote } = foundingAlliesContent;

export function AlliesExpo() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="allies-expo-title"
    >
      <Container>
        <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="ck-overline text-ck-yellow">{expo.eyebrow}</p>
            <h2 id="allies-expo-title" className="ck-display-lg mt-6 text-ck-text">
              {expo.title}
            </h2>
            <p className="ck-accent-script mt-8 text-2xl text-ck-text-secondary md:text-3xl">
              {expo.lead}
            </p>
            <p className="ck-body-lg mt-8 max-w-prose text-ck-text-secondary">
              {expo.body}
            </p>
            <ul className="mt-10 flex flex-wrap gap-2">
              {expo.categories.map((category) => (
                <li
                  key={category}
                  className="border border-ck-border px-3 py-2 text-sm uppercase tracking-[0.12em] text-ck-text-secondary"
                >
                  {category}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <MagazineImage
              src={expo.image.src}
              alt={expo.image.alt}
              aspect="landscape"
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="w-full"
            />
            <ConceptualNote className="mt-4">{conceptualNote}</ConceptualNote>
          </div>
        </div>
      </Container>
    </Section>
  );
}
