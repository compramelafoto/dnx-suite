import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "../../../../../lib/auth";
import { EntryError, listContestEntriesForOrganizer } from "../../../../../lib/fotorank/entries";
import { PageContainer } from "../../../../../components/PageContainer";

type Props = { params: Promise<{ id: string }> };

export default async function ContestInscripcionesAdminPage({ params }: Props) {
  const user = await requireAuth();
  const { id: contestId } = await params;

  let rows: Awaited<ReturnType<typeof listContestEntriesForOrganizer>> = [];
  let stats = {
    totalRegistrations: 0,
    withoutPhoto: 0,
    uploaded: 0,
    confirmed: 0,
    approved: 0,
    approvedWithWarnings: 0,
    requiresReview: 0,
    rejected: 0,
  };

  try {
    rows = await listContestEntriesForOrganizer({ contestId, organizerUserId: user.id });
    stats = {
      totalRegistrations: rows.length,
      withoutPhoto: rows.filter((r) => !r.entryId).length,
      uploaded: rows.filter((r) => r.entryId && r.entryStatus !== "DRAFT").length,
      confirmed: rows.filter((r) => r.entryStatus === "CONFIRMED").length,
      approved: rows.filter((r) => r.technicalSummaryStatus === "APPROVED").length,
      approvedWithWarnings: rows.filter((r) => r.technicalSummaryStatus === "APPROVED_WITH_WARNINGS").length,
      requiresReview: rows.filter((r) => r.technicalSummaryStatus === "REQUIRES_REVIEW").length,
      rejected: rows.filter(
        (r) => r.entryStatus === "REJECTED" || r.technicalSummaryStatus === "TECHNICALLY_REJECTED",
      ).length,
    };
  } catch (err) {
    if (err instanceof EntryError && err.code === "FORBIDDEN") redirect("/dashboard");
    if (err instanceof EntryError && err.code === "CONTEST_NOT_FOUND") notFound();
    throw err;
  }

  return (
    <PageContainer
      title="Inscripciones y obras"
      description="Panel operativo mínimo: participantes, estado técnico y checklist."
    >
      <div className="mb-8 flex flex-wrap gap-4">
        <Link href={`/dashboard/concursos/${contestId}`} className="text-sm text-gold hover:text-gold-hover">
          ← Volver al concurso
        </Link>
        <Link
          href={`/dashboard/concursos/${contestId}/admision`}
          className="text-sm text-fr-muted hover:text-gold"
        >
          Cola de admisión técnica
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="org-entry-stats">
        {[
          ["Inscriptos", stats.totalRegistrations],
          ["Sin foto", stats.withoutPhoto],
          ["Confirmadas", stats.confirmed],
          ["Requieren revisión", stats.requiresReview],
        ].map(([label, value]) => (
          <div key={String(label)} className="fr-recuadro border border-fr-border bg-fr-card">
            <p className="text-xs uppercase tracking-wide text-fr-muted">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-fr-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="fr-recuadro mt-10 overflow-x-auto border border-fr-border bg-fr-card">
        <table className="min-w-full text-left text-sm" data-testid="org-entries-table">
          <thead className="border-b border-fr-border text-fr-muted">
            <tr>
              <th className="px-4 py-3">Nº insc.</th>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Obra</th>
              <th className="px-4 py-3">Técnico</th>
              <th className="px-4 py-3">Warn/Fail</th>
              <th className="px-4 py-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.registrationId} className="border-b border-fr-border/60">
                <td className="px-4 py-3 text-gold">{r.registrationNumber}</td>
                <td className="px-4 py-3">
                  <div className="text-fr-primary">{r.participantName ?? "—"}</div>
                  <div className="text-xs text-fr-muted">{r.participantEmail}</div>
                </td>
                <td className="px-4 py-3 text-fr-primary">{r.categoryName}</td>
                <td className="px-4 py-3 text-fr-primary">
                  {r.entryStatus ?? "—"}
                  {r.entryNumber ? <div className="text-xs text-fr-muted">{r.entryNumber}</div> : null}
                </td>
                <td className="px-4 py-3 text-fr-primary">{r.technicalSummaryStatus ?? "—"}</td>
                <td className="px-4 py-3 text-fr-muted">
                  {r.warnings}/{r.failures}
                  {r.requiresReview ? ` · RR ${r.requiresReview}` : ""}
                </td>
                <td className="px-4 py-3">
                  {r.entryId ? (
                    <Link
                      href={`/dashboard/concursos/${contestId}/inscripciones/${r.entryId}`}
                      className="text-gold hover:text-gold-hover"
                    >
                      Ver detalle
                    </Link>
                  ) : (
                    <span className="text-fr-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-fr-muted">
                  Todavía no hay inscripciones.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
