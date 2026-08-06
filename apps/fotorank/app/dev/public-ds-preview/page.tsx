import { notFound } from "next/navigation";
import type { PublicContestLandingData } from "../../lib/fotorank/publicContestLanding";
import { ContestPublicLanding } from "../../concursos/[slug]/ContestPublicLanding";
import {
  EmptyState,
  ParticipantDashboard,
  PrimaryButton,
  PublicShell,
} from "../../components/public-ui";
import {
  buildParticipantChecklist,
  presentArtworkStatus,
  presentRegistrationStatus,
} from "../../lib/fotorank/public-ux/participant-status";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Preview DS público | FotoRank",
};

function previewEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_PUBLIC_DS_PREVIEW === "1"
  );
}

function fixtureLanding(phase: "open" | "closed" | "no-hero"): PublicContestLandingData {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const open = phase !== "closed";
  return {
    contest: {
      id: "preview-contest",
      title: "Santa Fe en Foco",
      slug: "santa-fe-en-foco",
      shortDescription:
        "Concurso fotográfico provincial. Inscripción gratuita. Una fotografía por participante.",
      fullDescription:
        "Convocatoria abierta a fotógrafos profesionales, aficionados y reporteros gráficos.\n\nLa fotografía presentada deberá haber sido realizada dentro del territorio de la Provincia de Santa Fe.",
      coverImageUrl: phase === "no-hero" ? null : null,
      rulesText: "Bases de ejemplo para validación visual. No son bases oficiales.",
      prizesSummary: "Premios según bases oficiales del concurso.",
      sponsorsText: null,
      rulesData: { prizes: [], rewards: [] },
      startAt: new Date(now - 30 * day),
      submissionDeadline: open ? new Date(now + 20 * day) : new Date(now - 2 * day),
      judgingStartAt: new Date(now + 40 * day),
      judgingEndAt: new Date(now + 55 * day),
      resultsAt: new Date(now + 70 * day),
      categories: [
        {
          id: "c1",
          name: "Fotógrafo profesional",
          slug: "fotografo-profesional",
          description: "Cámara fotográfica. No se admiten capturas con teléfono celular.",
          maxFiles: 1,
        },
        {
          id: "c2",
          name: "Fotógrafo amateur",
          slug: "fotografo-amateur",
          description: "Se admiten teléfono celular o cámara.",
          maxFiles: 1,
        },
      ],
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    organization: {
      id: "org-preview",
      name: "Sociedad de Fotógrafos Profesionales de Rosario",
      slug: "sfpr",
      shortDescription: "Organización institucional del concurso.",
      description: null,
      logoUrl: null,
      coverImageUrl: null,
      city: "Rosario",
      country: "Argentina",
      address: null,
      contactEmail: "contacto@example.org",
      phone: null,
      whatsapp: null,
      website: null,
      instagram: null,
    },
    judges: [],
  };
}

type Props = { searchParams: Promise<{ view?: string }> };

export default async function PublicDsPreviewPage({ searchParams }: Props) {
  if (!previewEnabled()) notFound();
  const { view = "landing-open" } = await searchParams;

  if (view === "landing-closed") {
    return <ContestPublicLanding data={fixtureLanding("closed")} />;
  }
  if (view === "landing-no-hero") {
    return <ContestPublicLanding data={fixtureLanding("no-hero")} />;
  }
  if (view === "participant-empty") {
    return (
      <PublicShell header={{ variant: "participant", hasSession: true, userEmail: "participante@example.com" }}>
        <div className="fr-public-container py-12">
          <EmptyState
            title="Todavía no tenés inscripciones"
            description="Explorá los concursos públicos y completá tu inscripción cuando esté abierta."
            action={<PrimaryButton href="/">Explorar concursos</PrimaryButton>}
          />
        </div>
      </PublicShell>
    );
  }
  if (view === "participant-dashboard" || view === "upload-closed") {
    const uploadOpen = view !== "upload-closed";
    const registrationStatus = presentRegistrationStatus("CONFIRMED");
    const artworkStatus = presentArtworkStatus({
      hasEntry: view === "participant-dashboard",
      entryStatus: view === "participant-dashboard" ? "CONFIRMED" : null,
      uploadOpen,
    });
    const checklist = buildParticipantChecklist({
      registered: true,
      registrationStatus: "CONFIRMED",
      hasEntry: view === "participant-dashboard",
      entryStatus: view === "participant-dashboard" ? "CONFIRMED" : null,
      uploadOpen,
    });
    return (
      <PublicShell header={{ variant: "participant", hasSession: true, userEmail: "participante@example.com" }}>
        <div className="fr-public-container fr-public-container--readable py-12">
          <ParticipantDashboard
            contestTitle="Santa Fe en Foco"
            participantLabel="participante@example.com"
            registrationStatus={registrationStatus}
            artworkStatus={artworkStatus}
            categoryName="Fotógrafo amateur"
            registrationNumber="SFE-R-000123"
            relevantDateLabel="Cierre: 30 de septiembre de 2026"
            checklist={checklist}
            primaryAction={
              view === "participant-dashboard" ? (
                <PrimaryButton href="/participaciones">Revisar participación</PrimaryButton>
              ) : uploadOpen ? (
                <PrimaryButton href="#cargar">Cargar fotografía</PrimaryButton>
              ) : (
                <PrimaryButton href="/participaciones">Ver mis participaciones</PrimaryButton>
              )
            }
            artworks={
              view === "participant-dashboard" ? (
                <div className="fr-public-card">Fotografía presentada · SFE-E-000045</div>
              ) : (
                <div className="fr-public-card text-[var(--foreground-muted)]">
                  Todavía no hay una fotografía presentada.
                </div>
              )
            }
          />
        </div>
      </PublicShell>
    );
  }

  return <ContestPublicLanding data={fixtureLanding("open")} />;
}
