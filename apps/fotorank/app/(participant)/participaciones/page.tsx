import { prisma } from "@repo/db";
import { requireAuth } from "../../lib/auth";
import { listMyRegistrations } from "../../lib/fotorank/registration";
import { resolvePublicEntryStatus } from "../../lib/fotorank/participant-experience/public-entry-status";
import { presentRegistrationStatus } from "../../lib/fotorank/public-ux/participant-status";
import {
  EmptyState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
} from "../../components/public-ui";

export default async function ParticipacionesPage() {
  const user = await requireAuth();
  const registrations = await listMyRegistrations(user.id);
  const entryByReg = new Map(
    (
      await prisma.fotorankContestEntry.findMany({
        where: { registrationId: { in: registrations.map((r) => r.id) } },
        select: {
          registrationId: true,
          status: true,
          entryNumber: true,
          technicalSummaryStatus: true,
          admissionStatus: true,
          manualReviewStatus: true,
          metadataJson: true,
        },
      })
    ).map((e) => [e.registrationId!, e]),
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Participante"
        title="Mis participaciones"
        description="Concursos en los que estás inscripto/a. Desde aquí podés ver el estado y continuar con lo que falte."
      />

      {registrations.length === 0 ? (
        <EmptyState
          title="Todavía no tenés inscripciones"
          description="Explorá los concursos públicos y completá tu inscripción cuando esté abierta."
          action={<PrimaryButton href="/">Explorar concursos</PrimaryButton>}
        />
      ) : (
        <ul className="grid gap-8 md:grid-cols-2" data-testid="participaciones-list">
          {registrations.map((r) => {
            const entry = entryByReg.get(r.id);
            const regStatus = presentRegistrationStatus(r.status);
            const meta =
              entry?.metadataJson &&
              typeof entry.metadataJson === "object" &&
              !Array.isArray(entry.metadataJson)
                ? (entry.metadataJson as Record<string, unknown>)
                : {};
            const ops =
              meta.admissionOps && typeof meta.admissionOps === "object"
                ? (meta.admissionOps as Record<string, unknown>)
                : {};
            const evidence =
              ops.evidenceRequest && typeof ops.evidenceRequest === "object"
                ? (ops.evidenceRequest as { status?: string })
                : null;
            const publicStatus = resolvePublicEntryStatus({
              entryStatus: entry?.status,
              admissionStatus: entry?.admissionStatus,
              manualReviewStatus: entry?.manualReviewStatus,
              evidenceOpen: evidence?.status === "OPEN",
            });
            const photoLabel = entry?.entryNumber
              ? `${publicStatus.label} · ${entry.entryNumber}`
              : publicStatus.label;

            return (
              <li
                key={r.id}
                className="fr-public-card"
                data-testid="participacion-card"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    label={regStatus.label}
                    tone={regStatus.tone}
                    stateText="Estado de inscripción"
                  />
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                  {r.contestTitle}
                </h2>
                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Número</dt>
                    <dd className="mt-2 font-semibold text-[var(--primary)]">
                      {r.registrationNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Categoría</dt>
                    <dd className="mt-2 text-[var(--foreground)]">{r.categoryName}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Fotografía</dt>
                    <dd
                      className="mt-2 text-[var(--foreground-muted)]"
                      data-testid="participacion-photo-status"
                      data-status-code={publicStatus.code}
                    >
                      {photoLabel}
                    </dd>
                  </div>
                </dl>
                <div className="mt-8 flex flex-wrap gap-3">
                  <PrimaryButton href={`/concursos/${r.contestSlug}/inscripcion`}>
                    Continuar participación
                  </PrimaryButton>
                  <SecondaryButton href={`/concursos/${r.contestSlug}`}>
                    Ver concurso
                  </SecondaryButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
