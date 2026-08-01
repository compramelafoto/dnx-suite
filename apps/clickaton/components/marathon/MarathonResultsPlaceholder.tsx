import { PhotoGallery } from "@/components/content/PhotoGallery";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { PhotoAsset } from "@/lib/photography";
import {
  juryToneToBadgeVariant,
  presentGalleryStatus,
  presentPublicResultsStatus,
} from "@/lib/jury-results/ui/jury-results-status-presentation";
import type { PublicMarathon } from "@/types/marathon";

type MarathonResultsPlaceholderProps = {
  marathon: PublicMarathon;
};

function galleryAssetsFromMarathon(marathon: PublicMarathon): PhotoAsset[] {
  return marathon.galleryPreview
    .filter((src): src is string => Boolean(src?.trim()))
    .map((src, index) => ({
      src,
      alt: `Fotografía pública ${index + 1} de ${marathon.name}`,
    }));
}

export function MarathonResultsPlaceholder({ marathon }: MarathonResultsPlaceholderProps) {
  const galleryImages = galleryAssetsFromMarathon(marathon);
  const results = presentPublicResultsStatus(marathon.resultsStatus);
  const gallery = presentGalleryStatus(marathon.galleryStatus);

  return (
    <>
      <Section aria-labelledby="marathon-results-title">
        <Container>
          <SectionHeader
            eyebrow="Después de la maratón"
            title="Resultados y galería"
            description="Los resultados públicos aparecen cuando la organización los publica. Mientras tanto solo se muestra el estado, sin ranking provisional como definitivo."
            titleId="marathon-results-title"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card className="space-y-3">
              <p className="ck-label text-ck-text-muted">Resultados</p>
              <Badge variant={juryToneToBadgeVariant(results.tone)}>{results.label}</Badge>
              <p className="ck-body-sm leading-relaxed text-ck-text-secondary">
                {results.description}
              </p>
              {results.publiclyVisible ? (
                <p className="ck-body-sm text-ck-text-muted">
                  Cuando Clickatón muestre el ranking, se presentará como resultado publicado — no
                  como un cálculo preliminar.
                </p>
              ) : (
                <p className="ck-body-sm text-ck-text-muted">
                  Todavía no se muestra ranking ni ganadores. No confundas un estado parcial con un
                  resultado oficial.
                </p>
              )}
            </Card>
            <Card className="space-y-3">
              <p className="ck-label text-ck-text-muted">Galería</p>
              <Badge variant={juryToneToBadgeVariant(gallery.tone)}>{gallery.label}</Badge>
              <p className="ck-body-sm leading-relaxed text-ck-text-secondary">
                {gallery.description}
              </p>
              <p className="ck-body-sm text-ck-text-muted">
                La galería pública solo incluirá fotografías autorizadas.
              </p>
            </Card>
          </div>
        </Container>
      </Section>

      <PhotoGallery
        eyebrow="Galería"
        title="Selección visual de la edición"
        description={
          galleryImages.length > 0
            ? "Fotografías autorizadas de la edición."
            : "Grilla lista para recibir fotografías autorizadas. Mientras tanto, se muestra la composición editorial del sistema."
        }
        images={galleryImages}
        emptySlots={6}
      />
    </>
  );
}
