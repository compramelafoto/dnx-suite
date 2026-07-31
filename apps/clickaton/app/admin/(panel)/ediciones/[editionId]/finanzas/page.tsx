import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { EditionDistributionEditor } from "@/components/admin/EditionDistributionEditor";
import {
  activateEditionDistributionFormAction,
  dryRunEditionCheckoutPlanFormAction,
  getEditionFinancePageData,
  validateEditionFinanceConfigFormAction,
} from "@/lib/admin/edition-finance/actions/edition-finance";
import { getEditionById } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ financeError?: string; financeOk?: string }>;
};

export default async function EditionFinancePage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const flash = await searchParams;
  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const data = await getEditionFinancePageData(editionId);
  const openDraft = data.distributions.find((d) => d.versionStatus === "DRAFT");
  const draftCanActivate = Boolean(
    openDraft &&
      openDraft.allocations.length > 0 &&
      openDraft.allocations.every((a) => a.paymentConnection?.canReceivePayments),
  );

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Finanzas de la edición"
        description={`${edition.name} — distribución por DNX Payments (acuerdo versionado). El % activo lo define la versión publicada del acuerdo (configurable; hoy Plan B temporal DNX 100%). Sin platform fee DNX en esta edición.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Finanzas" },
        ]}
      />

      {flash.financeError ? (
        <Card variant="outlined" className="border-red-500/40 text-sm text-red-300">
          {flash.financeError}
        </Card>
      ) : null}
      {flash.financeOk ? (
        <Card variant="outlined" className="border-emerald-500/40 text-sm text-emerald-300">
          {flash.financeOk}
        </Card>
      ) : null}

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
                {data.canMutate && d.versionStatus === "DRAFT" && d.versionId ? (
                  <div className="space-y-2 text-right">
                    {!draftCanActivate ? (
                      <p className="max-w-xs text-xs text-amber-700">
                        Para Activar, cada recipient del DRAFT necesita cuenta Mercado Pago
                        ACTIVE.
                      </p>
                    ) : null}
                    <form action={activateEditionDistributionFormAction.bind(null, editionId)}>
                      <input type="hidden" name="versionId" value={d.versionId} />
                      <Button type="submit" variant="primary" disabled={!draftCanActivate}>
                        Activar
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.canMutate ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {openDraft ? "Editar DRAFT de distribución" : "Crear DRAFT de distribución"}
          </h2>
          <EditionDistributionEditor
            editionId={editionId}
            recipients={data.recipients}
            draftVersionId={openDraft?.versionId ?? null}
            initialRows={
              openDraft
                ? openDraft.allocations.map((a) => ({
                    financialIdentityId: a.financialIdentityId,
                    paymentConnectionId: a.paymentConnectionId,
                    sharePercent: a.shareValue,
                  }))
                : data.active
                  ? data.active.allocations.map((a) => ({
                      financialIdentityId: a.financialIdentityId,
                      paymentConnectionId: a.paymentConnectionId,
                      sharePercent: a.shareValue,
                    }))
                  : [
                      {
                        financialIdentityId: "",
                        paymentConnectionId: null,
                        sharePercent: 100,
                      },
                    ]
            }
          />
        </section>
      ) : data.canManage ? (
        <p className="text-sm text-ck-text-muted">
          Tenés acceso de lectura/gestión parcial, pero solo DNX_FINANCE_OWNER puede editar
          recipients y porcentajes.
        </p>
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
