import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import type { PhotoAsset } from "@/lib/photography";
import { cn } from "@/lib/cn";

type PhotoGalleryProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  images: readonly PhotoAsset[];
  /** Cantidad de slots de fallback cuando no hay imágenes. */
  emptySlots?: number;
  className?: string;
};

/**
 * Galería editorial simple (sin lightbox).
 * Acepta 0..n imágenes; el vacío usa marcos del sistema.
 */
export function PhotoGallery({
  title = "Galería",
  eyebrow = "Fotografías",
  description,
  images,
  emptySlots = 6,
  className,
}: PhotoGalleryProps) {
  const hasImages = images.length > 0;
  const slots: PhotoAsset[] = hasImages
    ? [...images]
    : Array.from({ length: emptySlots }, (_, index) => ({
        src: "",
        alt: `Composición editorial ${index + 1}`,
      }));

  return (
    <Section tone="raised" aria-labelledby="photo-gallery-title" className={className}>
      <Container>
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={
            description ??
            (hasImages
              ? "Selección pública autorizada."
              : "Cuando haya fotografías autorizadas, aparecerán en esta grilla.")
          }
          titleId="photo-gallery-title"
        />
        <ul
          className={cn(
            "mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6",
          )}
        >
          {slots.map((image, index) => {
            const isVertical = index % 5 === 1;
            return (
              <li
                key={image.src || `slot-${index}`}
                className={cn(isVertical && "sm:row-span-1")}
              >
                <PhotoFrame
                  variant="gallery"
                  src={image.src || null}
                  alt={image.alt}
                  credit={image.credit}
                  caption={image.caption}
                  className={isVertical ? "aspect-[3/4] sm:aspect-[4/3]" : undefined}
                />
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
