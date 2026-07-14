import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  galleryStatusLabels,
  resultsStatusLabels,
  type PublicMarathon,
} from "@/types/marathon";

type MarathonResultsPlaceholderProps = {
  marathon: PublicMarathon;
};

export function MarathonResultsPlaceholder({ marathon }: MarathonResultsPlaceholderProps) {
  return (
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
              La galería pública solo incluirá fotografías autorizadas. No se usan imágenes externas
              en esta etapa.
            </p>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
