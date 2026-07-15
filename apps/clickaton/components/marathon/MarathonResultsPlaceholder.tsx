import { PhotoGallery } from "@/components/content/PhotoGallery";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { PhotoAsset } from "@/lib/photography";
import {
  galleryStatusLabels,
  resultsStatusLabels,
  type PublicMarathon,
} from "@/types/marathon";

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

  return (
    <>
      <Section aria-labelledby="marathon-results-title">
        <Container>
          <SectionHeader
            eyebrow="Después de la maratón"
            title="Resultados y galería"
            description="Estos bloques se activan cuando FotoRank publique resultados o galería. Hoy solo se muestra el estado."
            titleId="marathon-results-title"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card>
              <p className="ck-label text-ck-text-muted">Resultados</p>
              <div className="mt-3">
                <Badge variant="neutral">{resultsStatusLabels[marathon.resultsStatus]}</Badge>
              </div>
              <p className="ck-body-sm mt-4 text-ck-text-secondary">
                Cuando el estado sea “Publicados”, Clickatón mostrará el ranking y reconocimientos
                públicos de la edición.
              </p>
            </Card>
            <Card>
              <p className="ck-label text-ck-text-muted">Galería</p>
              <div className="mt-3">
                <Badge variant="warning">{galleryStatusLabels[marathon.galleryStatus]}</Badge>
              </div>
              <p className="ck-body-sm mt-4 text-ck-text-secondary">
                La galería pública solo incluirá fotografías autorizadas. No se usan imágenes
                externas en esta etapa.
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
