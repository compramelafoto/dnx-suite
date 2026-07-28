import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  closeBatchAction,
  ensureDraftBatchAction,
  evaluatePendingBulkAction,
  freezeBatchAction,
  reopenBatchAction,
} from "@/lib/technical-admission/actions";
import {
  ensureAdmissionConfig,
  getAdmissionDashboard,
} from "@/lib/technical-admission/service";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionAdmissionPage({ params }: Props) {
  const user = await requireClickatonAdmin();
  const { editionId } = await params;
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true },
  });
  if (!edition) notFound();

  await ensureAdmissionConfig(editionId);
  const dash = await getAdmissionDashboard(editionId, {
    id: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  const recent = await prisma.clickatonTechnicalAdmissionDecision.findMany({
    where: { editionId },
    orderBy: { evaluatedAt: "desc" },
    take: 25,
    select: {
      id: true,
      submissionId: true,
      status: true,
      eligible: true,
      publicRejectionReason: true,
      evaluatedAt: true,
      blockingReasons: true,
    },
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Admisión técnica · ${edition.name}`}
        description="Define qué obras entran al circuito de jurado. No asigna puntuaciones ni abre resultados LIVE."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Admisión" },
        ]}
        actions={
          <>
            <Button
              href={`/api/admin/editions/${editionId}/admission/export?mode=admin`}
              variant="secondary"
            >
              Export admin
            </Button>
            <Button
              href={`/api/admin/editions/${editionId}/admission/export?mode=jury`}
              variant="secondary"
            >
              Export jurado
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Envíos", dash.totals.submissions],
          ["Confirmados", dash.totals.confirmed],
          ["Elegibles", dash.totals.eligible],
          ["Admitidos", dash.totals.admitted],
          ["Revisión", dash.totals.pendingReview],
          ["Rechazados", dash.totals.rejected],
          ["Excluidos", dash.totals.excluded],
          ["Congelados", dash.totals.frozen],
          ["Sin entry FR", dash.totals.withoutEntry],
        ].map(([label, value]) => (
          <Card key={String(label)} variant="outlined" className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-ck-text-muted">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <Card variant="outlined" className="space-y-2 p-5 text-sm">
        <p>
          Admisión habilitada:{" "}
          <strong>{dash.config.admissionEnabled ? "SÍ" : "NO"}</strong>
          {" · "}acreditación:{" "}
          <strong>{dash.config.accreditationRequiredForAdmission}</strong>
          {" · "}reglas: <span className="font-mono text-xs">{dash.config.rulesVersion}</span>
        </p>
        <p className="text-ck-text-muted">
          Timeline v{dash.window.timelineVersion ?? "—"} · serverNow {dash.window.serverNow}
        </p>
        <p className="text-ck-text-secondary">
          Lote:{" "}
          {dash.batch
            ? `${dash.batch.id.slice(0, 8)}… · ${dash.batch.status} · admitidos ${dash.batch.admittedEntries} · pendientes ${dash.batch.pendingReviewEntries}`
            : "sin lote (crear abajo)"}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="font-semibold">Acciones de lote</h2>
        <div className="flex flex-wrap gap-3">
          <form action={ensureDraftBatchAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary" size="sm">
              Crear / obtener lote DRAFT
            </Button>
          </form>
          <form action={evaluatePendingBulkAction.bind(null, editionId)}>
            <input type="hidden" name="requestId" value={crypto.randomUUID()} />
            <input type="hidden" name="limit" value="100" />
            <Button type="submit" variant="primary" size="sm">
              Evaluar y admitir elegibles
            </Button>
          </form>
          {dash.batch ? (
            <>
              <form action={closeBatchAction.bind(null, editionId)}>
                <input type="hidden" name="batchId" value={dash.batch.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Cerrar lote
                </Button>
              </form>
              <form action={freezeBatchAction.bind(null, editionId)}>
                <input type="hidden" name="batchId" value={dash.batch.id} />
                <Button type="submit" variant="primary" size="sm">
                  Congelar para jurado
                </Button>
              </form>
              <form action={reopenBatchAction.bind(null, editionId)} className="flex flex-wrap gap-2">
                <input type="hidden" name="batchId" value={dash.batch.id} />
                <input
                  name="reason"
                  placeholder="Motivo reapertura"
                  className="rounded border border-ck-border bg-transparent px-3 py-2 text-sm"
                  required
                />
                <Button type="submit" variant="outline" size="sm">
                  Reabrir (no frozen)
                </Button>
              </form>
            </>
          ) : null}
        </div>
        <p className="text-xs text-ck-text-muted">
          No se abren puntuaciones desde este panel. El jurado futuro solo consume batch FROZEN +
          snapshots anónimos.
        </p>
      </Card>

      <Card variant="outlined" className="space-y-3 p-5">
        <h2 className="font-semibold">Decisiones recientes</h2>
        <ul className="space-y-2 text-sm">
          {recent.map((d) => (
            <li key={d.id} className="border-b border-ck-border py-2">
              <span className="font-mono text-xs">{d.submissionId.slice(0, 10)}…</span>
              {" · "}
              <strong>{d.status}</strong>
              {d.publicRejectionReason ? ` · ${d.publicRejectionReason}` : null}
            </li>
          ))}
          {recent.length === 0 ? (
            <li className="text-ck-text-muted">Sin evaluaciones todavía.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
