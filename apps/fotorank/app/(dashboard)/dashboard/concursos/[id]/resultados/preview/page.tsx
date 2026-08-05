import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { buildPrivatePreviewPayload } from "../../../../../../lib/fotorank/results";
import { prisma } from "@repo/db";
import { PageContainer } from "../../../../../../components/PageContainer";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ id: string }> };

export default async function ResultsPrivatePreviewPage({ params }: Props) {
  const { id: contestId } = await params;
  const user = await requireAuth();
  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError) notFound();
    throw err;
  }

  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { contestId, status: { notIn: ["CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!batch) {
    return (
      <PageContainer title="Preview resultados" description="Sin batch.">
        <p className="text-sm text-fr-muted">Generá un ResultBatch primero.</p>
      </PageContainer>
    );
  }

  const preview = await buildPrivatePreviewPayload({ contestId, batchId: batch.id });

  return (
    <PageContainer
      title="Preview privado de resultados"
      description="Exactamente la vista previa de publicación. No indexable. No público."
    >
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href={`/dashboard/concursos/${contestId}/resultados`} className="fr-btn fr-btn-secondary text-sm">
          ← Volver a resultados
        </Link>
      </div>
      <section className="fr-recuadro space-y-6 border border-fr-border bg-fr-card" data-testid="results-private-preview">
        <p className="text-sm text-amber-200">{preview.note}</p>
        <p className="text-sm">
          Readiness: <strong data-testid="preview-readiness">{preview.readiness.status}</strong>
        </p>
        <p className="text-sm break-all font-mono text-xs">Hash: {preview.publicationHash}</p>
        <p className="text-sm">
          Rúbrica: {preview.rubricStatus} · Premios: {preview.awardsStatus} · Scores públicos:{" "}
          {preview.publicScoresMode}
        </p>
        <div>
          <h3 className="font-semibold mb-3">Finalistas ({preview.finalists.length})</h3>
          <ul className="text-sm space-y-1">
            {preview.finalists.map((f) => (
              <li key={`${f.categoryId}-${f.anonymousCode}`}>
                {f.anonymousCode} · {f.status}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Ganadores ({preview.winners.length})</h3>
          <ul className="text-sm space-y-1">
            {preview.winners.map((w) => (
              <li key={`${w.categoryId}-${w.awardType}-${w.anonymousCode}`}>
                {w.anonymousCode} · {w.awardType} · {w.source}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Ranking (privado, con scores)</h3>
          <ul className="text-sm space-y-1 max-h-96 overflow-auto">
            {preview.entries.slice(0, 50).map((e) => (
              <li key={`${e.categoryId}-${e.anonymousCode}`}>
                #{e.position ?? "—"} {e.anonymousCode} · {e.awardType ?? "—"} · score{" "}
                {e.aggregateScore ?? "—"}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageContainer>
  );
}
