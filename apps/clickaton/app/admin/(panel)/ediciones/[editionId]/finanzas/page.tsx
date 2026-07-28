import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import {
  activateEditionDistributionFormAction,
  createTammyDraftFormAction,
  dryRunEditionCheckoutPlanFormAction,
  getEditionFinancePageData,
  validateEditionFinanceConfigFormAction,
} from "@/lib/admin/edition-finance/actions/edition-finance";
import { FINANCE_SEED_EMAILS } from "@/lib/admin/edition-finance/constants";
import { getEditionById } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";

type Props = {
  params: Promise<{ editionId: string }>;
};

export default async function EditionFinancePage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const data = await getEditionFinancePageData(editionId);

  const tammyUser = await prisma.user.findFirst({
    where: { email: { equals: FINANCE_SEED_EMAILS.tammy, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const tammyIdentity = tammyUser
    ? await prisma.dnxFinancialIdentity.findFirst({
        where: { ownerUserId: tammyUser.id, subjectType: "PERSON" },
        include: {
          paymentAccounts: {
            where: { status: { in: ["ACTIVE", "PENDING", "NEEDS_REAUTH"] } },
            orderBy: { updatedAt: "desc" },
            take: 5,
          },
        },
      })
    : null;

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Finanzas de la edición"
        description={`${edition.name} — distribución por DNX Payments (acuerdo versionado). Tammy 100% del importe distribuible tras fees del PSP; sin platform fee DNX en esta edición.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Finanzas" },
        ]}
      />

      <Card variant="outlined" className="space-y-4 border-ck-yellow/40">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
          Readiness checkout (Etapa 6)
        </p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            Distribución:{" "}
            <strong>{data.readiness.distributionStatus}</strong>
          </li>
          <li>
            Suma 100%:{" "}
            {data.readiness.sumOk ? (
              <Badge variant="success">OK</Badge>
            ) : (
              <Badge variant="danger">No</Badge>
            )}
          </li>
          <li>Beneficiaria: {data.readiness.beneficiaryLabel}</li>
          <li>
            Payment account:{" "}
            {data.readiness.paymentAccountConnected ? "conectada" : "no conectada"}
          </li>
          <li>
            OAuth: {data.readiness.oauthLikelyValid ? "válido" : "no válido / pendiente"}
          </li>
          <li>Modo cuenta: {data.readiness.accountMode}</li>
          <li>
            Checkout allocations:{" "}
            {data.readiness.checkoutAllocationsReady ? "listo" : "no listo"}
          </li>
          <li>
            Webhook: {data.readiness.webhookReady ? "listo" : "no listo"}
          </li>
          <li>
            Refunds: <Badge variant="danger">bloqueado</Badge>
          </li>
          <li>
            Ledger completo: <Badge variant="warning">pendiente</Badge>
          </li>
          <li>
            Provider: <code>{data.readiness.checkoutProvider}</code>
          </li>
        </ul>
        {data.readiness.lastError ? (
          <p className="text-sm text-amber-700">
            Último error de conexión (sin secretos): {data.readiness.lastError}
          </p>
        ) : null}
        <p className="text-xs text-ck-text-muted">
          Modalidad operativa Tammy 100%: Checkout Pro con collector OAuth del beneficiario.
          No hay split multi-receptor nativo en Preferences. Refunds/chargebacks siguen
          bloqueando LIVE.
        </p>
        {data.canManage ? (
          <div className="flex flex-wrap gap-3 pt-2">
            <form action={validateEditionFinanceConfigFormAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary">
                Validar configuración
              </Button>
            </form>
            <form action={dryRunEditionCheckoutPlanFormAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary">
                Checkout de prueba (dry-run)
              </Button>
            </form>
          </div>
        ) : null}
      </Card>

      <Card variant="outlined" className="space-y-3 border-ck-yellow/40">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
          Gate comercial
        </p>
        <p className="text-sm">
          Modo evaluado: <strong>{data.gate.mode}</strong> ·{" "}
          {data.gate.ok ? (
            <Badge variant="success">Listo</Badge>
          ) : (
            <Badge variant="danger">Bloqueado</Badge>
          )}
        </p>
        {data.gate.blockers.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--ck-danger)]">
            {data.gate.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {data.gate.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
            {data.gate.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        {!data.canManage ? (
          <p className="text-sm text-ck-text-secondary">
            Solo lectura: no tenés permiso financiero (
            <code>canManageEditionFinancialDistribution</code>).
          </p>
        ) : null}
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Versión activa</h2>
        {!data.active ? (
          <p className="text-sm text-ck-text-muted">No hay distribución ACTIVE.</p>
        ) : (
          <Card variant="outlined" className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="success">ACTIVE v{data.active.version}</Badge>
              <span>Acuerdo {data.active.id.slice(0, 8)}…</span>
              <span>Fee policy: {data.active.feePolicy ?? "—"}</span>
              <span>Redondeo: {data.active.roundingPolicy}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-ck-text-secondary">
                  <tr>
                    <th className="py-2">Beneficiario</th>
                    <th className="py-2">%</th>
                    <th className="py-2">Conexión</th>
                    <th className="py-2">Entorno</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.active.allocations.map((a) => (
                    <tr key={a.id} className="border-t border-ck-border">
                      <td className="py-3">
                        {a.beneficiaryDisplayName}
                        <div className="text-xs text-ck-text-muted">
                          {a.beneficiaryEmailMasked ?? "—"}
                        </div>
                      </td>
                      <td className="py-3">{a.shareValue}%</td>
                      <td className="py-3 font-mono text-xs">
                        {a.paymentConnectionId
                          ? `${a.paymentConnectionId.slice(0, 10)}…`
                          : "Sin conexión"}
                      </td>
                      <td className="py-3">{a.paymentConnection?.environment ?? "—"}</td>
                      <td className="py-3">{a.paymentConnection?.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Versiones</h2>
        {data.distributions.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Sin versiones todavía.</p>
        ) : (
          <ul className="space-y-3">
            {data.distributions.map((d) => (
              <li
                key={`${d.id}-${d.versionId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-ck-border p-4 text-sm"
              >
                <div>
                  <strong>v{d.version}</strong> · {d.status} ·{" "}
                  {d.allocations
                    .map((a) => `${a.beneficiaryDisplayName} ${a.shareValue}%`)
                    .join(", ")}
                </div>
                {data.canManage && d.versionStatus === "DRAFT" && d.versionId ? (
                  <form action={activateEditionDistributionFormAction.bind(null, editionId)}>
                    <input type="hidden" name="versionId" value={d.versionId} />
                    <Button type="submit" variant="primary">
                      Activar
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.canManage ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Crear DRAFT Tammy 100%</h2>
          {!tammyIdentity ? (
            <p className="text-sm text-amber-700">
              No se encontró identidad financiera para {FINANCE_SEED_EMAILS.tammy}. Creá la
              identidad / conexión Mercado Pago antes de activar.
            </p>
          ) : (
            <form
              action={createTammyDraftFormAction.bind(null, editionId)}
              className="space-y-4 rounded border border-ck-border p-4"
            >
              <input type="hidden" name="financialIdentityId" value={tammyIdentity.id} />
              <label className="block space-y-2 text-sm">
                <span className="text-ck-text-secondary">Conexión Mercado Pago</span>
                <select
                  name="paymentConnectionId"
                  className="block w-full rounded border border-ck-border bg-ck-surface px-3 py-2"
                  defaultValue={tammyIdentity.paymentAccounts[0]?.id ?? ""}
                >
                  <option value="">Sin conexión (DRAFT sin activar)</option>
                  {tammyIdentity.paymentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.environment} · {acc.status} ·{" "}
                      {acc.providerUserId ?? acc.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-ck-text-muted">
                No se muestran tokens. No se activa automáticamente sin conexión válida.
              </p>
              <Button type="submit" variant="secondary">
                Crear versión DRAFT
              </Button>
            </form>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Auditoría</h2>
        {data.audits.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Sin eventos.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.audits.map((a) => (
              <li key={a.id} className="border-b border-ck-border/60 py-2">
                <span className="font-mono text-xs">{a.createdAt.toISOString()}</span> ·{" "}
                {a.action}
                {a.actorUserId ? ` · user #${a.actorUserId}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
