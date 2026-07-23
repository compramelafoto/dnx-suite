import Link from "next/link";
import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listPublicMarathons } from "@/data/public-marathons/service";
import { homeContent } from "@/content/home";
import { marathonPath, marathonRegistrationPath } from "@/config/navigation";

/**
 * Agenda home: muestra ediciones publicadas (Prisma/piloto) o empty state honesto.
 */
export async function UpcomingEventsSection() {
  const { upcoming } = homeContent;
  let editions: Awaited<ReturnType<typeof listPublicMarathons>> = [];
  try {
    editions = (await listPublicMarathons()).filter((m) => !m.isDemo);
  } catch {
    editions = [];
  }

  return (
    <Section id={upcoming.id} tone="raised" aria-labelledby="upcoming-title">
      <Container>
        <SectionHeader
          eyebrow={upcoming.eyebrow}
          title={upcoming.title}
          titleId="upcoming-title"
          action={
            <Badge variant="brand">
              {editions.length > 0 ? "Inscripción abierta (TEST)" : upcoming.status}
            </Badge>
          }
        />

        {editions.length === 0 ? (
          <Card variant="outlined" className="mt-10 border-dashed bg-ck-surface">
            <EditorialLabel>Agenda</EditorialLabel>
            <p className="ck-heading-lg mt-4">{upcoming.message}</p>
            <p className="ck-body-sm mt-3 text-ck-text-muted">{upcoming.note}</p>
            <div className="mt-6">
              <Button href="/maratones" variant="secondary">
                Ver maratones
              </Button>
            </div>
          </Card>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {editions.slice(0, 4).map((edition) => (
              <Card key={edition.id} variant="outlined" className="flex flex-col gap-4 p-6">
                <div>
                  <EditorialLabel>{edition.city}</EditorialLabel>
                  <h3 className="ck-heading-md mt-3">{edition.name}</h3>
                  <p className="mt-2 text-sm text-ck-text-secondary">
                    {edition.shortDescription}
                  </p>
                  <p className="mt-3 text-sm text-ck-text-muted">
                    {new Date(edition.startAt).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" · "}
                    {edition.registration?.displayPrice?.formatted ?? "Ver entrada"}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-3">
                  <Button href={marathonPath(edition.slug)} variant="secondary">
                    Ver ficha
                  </Button>
                  {edition.registration?.canRegister ? (
                    <Button
                      href={marathonRegistrationPath(edition.slug)}
                      variant="primary"
                    >
                      Inscribirme
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-ck-text-muted">
                  Entorno de prueba — no se realiza un cobro real.{" "}
                  <Link href={marathonPath(edition.slug)} className="text-ck-yellow hover:underline">
                    Detalles
                  </Link>
                </p>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
