import { prisma } from "@repo/db";
import { requireAuth } from "../../lib/auth";
import { listMyRegistrations } from "../../lib/fotorank/registration";
import {
  presentArtworkStatus,
  presentRegistrationStatus,
} from "../../lib/fotorank/public-ux/participant-status";
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
            const artStatus = presentArtworkStatus({
              hasEntry: Boolean(entry),
              entryStatus: entry?.status,
              technicalSummaryStatus: entry?.technicalSummaryStatus,
              uploadOpen: true,
            });
            const photoLabel = !entry
              ? artStatus.label
              : entry.status === "CONFIRMED"
                ? `Presentada${entry.entryNumber ? ` · ${entry.entryNumber}` : ""}`
                : artStatus.label;

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
                    <dd className="mt-2 text-[var(--foreground-muted)]">{photoLabel}</dd>
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
