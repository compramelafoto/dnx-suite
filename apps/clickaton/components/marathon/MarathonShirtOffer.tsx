import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ARGENTINA_2026_MERCH, ARGENTINA_2026_SHIRT_SIZES } from "@/config/editions/argentina-2026";

export type ShirtOfferMedia = {
  mediaType: string;
  url: string;
  alt: string;
};

type Props = {
  media: ShirtOfferMedia[];
};

export function MarathonShirtOffer({ media }: Props) {
  if (media.length === 0) return null;
  const sizes = ARGENTINA_2026_SHIRT_SIZES.map((s) => s.name).join(" · ");

  return (
    <Section aria-labelledby="marathon-shirt-title">
      <Container>
        <SectionHeader
          eyebrow="Beneficio"
          title="Remera oficial Clickatón"
          description={`Remera oficial de regalo para los primeros ${ARGENTINA_2026_MERCH.firstNBenefitLimit} inscriptos con pago confirmado, o hasta el 30 de agosto, lo que ocurra primero. Elegí tu talle al completar tus datos.`}
          titleId="marathon-shirt-title"
        />
        <p className="ck-body-sm mt-6 text-ck-text-muted">Talles: {sizes}</p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <li
              key={`${item.mediaType}-${item.url}`}
              className="overflow-hidden border-2 border-ck-border bg-ck-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt}
                className="aspect-[4/5] w-full object-cover"
                loading="lazy"
              />
              <p className="ck-label px-4 py-3 text-ck-text-muted">
                {item.mediaType === "PRIMARY"
                  ? "Principal"
                  : item.mediaType === "SIZE_CHART"
                    ? "Guía de talles"
                    : item.mediaType === "DETAIL"
                      ? "Detalle / guía"
                      : "Galería"}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
