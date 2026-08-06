import Link from "next/link";
import { prisma } from "@repo/db";
import { requireAuth } from "../../lib/auth";
import { listMyRegistrations } from "../../lib/fotorank/registration";
import { resolvePublicEntryStatus } from "../../lib/fotorank/participant-experience/public-entry-status";

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
      <header className="space-y-4">
        <p className="fr-eyebrow text-gold">Participante</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight md:text-4xl">Mis participaciones</h1>
        <p className="max-w-2xl text-base leading-relaxed text-fr-muted">
          Concursos en los que estás inscripto/a y el estado de tu fotografía.
        </p>
      </header>

      {registrations.length === 0 ? (
        <div className="fr-recuadro max-w-md border border-fr-border bg-fr-card">
          <p className="fr-body text-fr-muted">Todavía no tenés inscripciones.</p>
          <Link href="/" className="fr-btn fr-btn-primary mt-8 inline-flex w-fit px-6 py-3">
            Explorar concursos
          </Link>
        </div>
      ) : (
        <ul className="grid gap-8 md:grid-cols-2" data-testid="participaciones-list">
          {registrations.map((r) => {
            const entry = entryByReg.get(r.id);
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
            <li key={r.id} className="fr-recuadro border border-fr-border bg-fr-card" data-testid="participacion-card">
              <h2 className="text-xl font-semibold tracking-tight text-fr-primary">{r.contestTitle}</h2>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-fr-muted">Número</dt>
                  <dd className="mt-2 font-semibold text-gold">{r.registrationNumber}</dd>
                </div>
                <div>
                  <dt className="text-fr-muted">Categoría</dt>
                  <dd className="mt-2 text-fr-primary">{r.categoryName}</dd>
                </div>
                <div>
                  <dt className="text-fr-muted">Estado</dt>
                  <dd className="mt-2 text-fr-primary">{r.status === "CONFIRMED" ? "Inscripto/a" : r.status}</dd>
                </div>
                <div>
                  <dt className="text-fr-muted">Fotografía</dt>
                  <dd
                    className="mt-2 text-fr-muted"
                    data-testid="participacion-photo-status"
                    data-status-code={publicStatus.code}
                  >
                    {photoLabel}
                  </dd>
                </div>
              </dl>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/concursos/${r.contestSlug}/inscripcion`}
                  className="fr-btn fr-btn-primary px-5 py-3 text-sm"
                >
                  Continuar participación
                </Link>
                <Link
                  href={`/concursos/${r.contestSlug}`}
                  className="fr-btn fr-btn-secondary px-5 py-3 text-sm"
                >
                  Ver concurso
                </Link>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
