import type { ContestMediaAsset } from "../../lib/fotorank/contest-visual";
import { usableGallery } from "../../lib/fotorank/contest-visual";
import { ContestMediaFigure } from "./ContestMedia";
import { ContentContainer, PageSection, SectionHeading } from "./primitives";

type Props = {
  items: ContestMediaAsset[];
  title?: string;
};

/** Galería editorial: solo se renderiza si hay 1+ imágenes válidas. */
export function ContestGallery({ items, title = "Galería" }: Props) {
  const gallery = usableGallery(items).slice(0, 8);
  if (gallery.length === 0) return null;

  return (
    <PageSection id="galeria" tone="muted">
      <ContentContainer>
        <SectionHeading title={title} />
        <ul className="fr-contest-gallery">
          {gallery.map((asset, i) => (
            <li key={`${asset.url}-${i}`} className="fr-contest-gallery__item">
              <ContestMediaFigure asset={asset} sizes="(max-width: 768px) 100vw, 33vw" />
            </li>
          ))}
        </ul>
      </ContentContainer>
    </PageSection>
  );
}
