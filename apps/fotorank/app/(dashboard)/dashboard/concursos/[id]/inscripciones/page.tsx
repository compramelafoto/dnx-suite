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
    // Los contadores de obras cuentan obras, no inscripciones: una persona
    // puede presentar varias (y en varias categorías).
    const obras = rows.flatMap((r) => r.entries);
    stats = {
      totalRegistrations: rows.length,
      withoutPhoto: rows.filter((r) => r.entries.length === 0).length,
      uploaded: obras.filter((e) => e.entryStatus !== "DRAFT").length,
      confirmed: obras.filter((e) => e.entryStatus === "CONFIRMED").length,
      approved: obras.filter((e) => e.technicalSummaryStatus === "APPROVED").length,
      approvedWithWarnings: obras.filter((e) => e.technicalSummaryStatus === "APPROVED_WITH_WARNINGS").length,
      requiresReview: obras.filter((e) => e.technicalSummaryStatus === "REQUIRES_REVIEW").length,
      rejected: obras.filter(
        (e) => e.entryStatus === "REJECTED" || e.technicalSummaryStatus === "TECHNICALLY_REJECTED",
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
          ["Obras confirmadas", stats.confirmed],
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
            {rows.map((r) => {
              // Una fila por obra; la inscripción sin obras igual aparece, con "—".
              const obras = r.entries.length > 0 ? r.entries : [null];
              return obras.map((e, i) => (
                <tr
                  key={e?.entryId ?? r.registrationId}
                  className={i === obras.length - 1 ? "border-b border-fr-border/60" : ""}
                >
                  {i === 0 ? (
                    <>
                      <td className="px-4 py-3 align-top text-gold" rowSpan={obras.length}>
                        {r.registrationNumber}
                        {obras.length > 1 ? (
                          <div className="text-xs text-fr-muted">{obras.length} obras</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top" rowSpan={obras.length}>
                        <div className="text-fr-primary">{r.participantName ?? "—"}</div>
                        <div className="text-xs text-fr-muted">{r.participantEmail}</div>
                      </td>
                    </>
                  ) : null}
                  <td className="px-4 py-3 text-fr-primary">{e?.categoryName ?? r.categoryName}</td>
                  <td className="px-4 py-3 text-fr-primary">
                    {e?.entryStatus ?? "—"}
                    {e?.entryNumber ? <div className="text-xs text-fr-muted">{e.entryNumber}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-fr-primary">{e?.technicalSummaryStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-fr-muted">
                    {e ? `${e.warnings}/${e.failures}` : "—"}
                    {e?.requiresReview ? ` · RR ${e.requiresReview}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {e ? (
                      <Link
                        href={`/dashboard/concursos/${contestId}/inscripciones/${e.entryId}`}
                        className="text-gold hover:text-gold-hover"
                      >
                        Ver detalle
                      </Link>
                    ) : (
                      <span className="text-fr-muted">—</span>
                    )}
                  </td>
                </tr>
              ));
            })}
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
