import { ConceptualNote } from "@/components/founding-allies/ConceptualNote";
import { MagazineImage } from "@/components/founding-allies/MagazineImage";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { foundingAlliesContent } from "@/content/founding-allies";

const { imagine, brandIntegrationNote, conceptualNote } = foundingAlliesContent;

export function AlliesImagine() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="allies-imagine-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{imagine.eyebrow}</p>
          <h2 id="allies-imagine-title" className="ck-display-lg mt-6 text-ck-text">
            {imagine.title}
          </h2>
          <p className="ck-accent-script mt-8 text-2xl text-ck-text-secondary md:text-3xl">
            {imagine.lead}
          </p>
          <p className="ck-body-lg mt-8 max-w-prose text-ck-text-secondary">
            {imagine.body}
          </p>
          <div className="mt-6 space-y-3">
            <ConceptualNote>{brandIntegrationNote}</ConceptualNote>
            <ConceptualNote>{conceptualNote}</ConceptualNote>
          </div>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
          {imagine.highlights.map((item, index) => (
            <li
              key={item.title}
              className={
                index === 0 || index === 5
                  ? "sm:col-span-2 lg:col-span-2"
                  : undefined
              }
            >
              <MagazineImage
                src={item.src}
                alt={item.alt}
                aspect={
                  index === 0 || index === 5 ? "landscape" : "portrait"
                }
                sizes="(max-width: 1024px) 100vw, 25vw"
              />
              <p className="ck-label mt-4 text-ck-text-secondary">{item.title}</p>
            </li>
          ))}
        </ul>

        <aside
          className="mt-16 grid gap-8 border border-ck-border bg-ck-surface-raised/40 p-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:p-10 lg:gap-12"
          aria-label="Ejemplo conceptual de integración de marca"
        >
          <MagazineImage
            src="/images/founding-allies/tee-back-allies.jpg"
            alt="Ejemplo conceptual de integración de marcas en espalda de remera Clickatón"
            aspect="portrait"
            sizes="(max-width: 768px) 100vw, 40vw"
          />
          <div className="flex flex-col justify-center">
            <p className="ck-overline text-ck-yellow">Integración</p>
            <h3 className="ck-heading-lg mt-4 text-ck-text">Imaginá tu marca acá</h3>
            <p className="ck-body-md mt-6 max-w-prose text-ck-text-secondary">
              Las marcas que aparecen en este mockup son solo referencias visuales
              de cómo puede convivir una alianza en la pieza. No son sponsors
              confirmados de una edición.
            </p>
            <ConceptualNote className="mt-6">{brandIntegrationNote}</ConceptualNote>
            <ConceptualNote className="mt-3">{conceptualNote}</ConceptualNote>
          </div>
        </aside>
      </Container>
    </Section>
  );
}
