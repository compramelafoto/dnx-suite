import { ActionResultMessage } from "@/components/admin/affiliates/ActionResultMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { markCommissionPaidOutAction } from "@/lib/affiliates/admin/actions";
import { listAffiliateNames, listCommissionsForAdmin } from "@/lib/affiliates/admin/queries";
import {
  COMMISSION_STATUS_LABELS,
  commissionStatusLabel,
  formatCommissionBps,
} from "@/lib/affiliates/domain/labels";
import {
  COMMISSION_STATUS_BADGE,
  COMMISSION_STATUS_ORDER,
  commissionBadgeVariant,
  formatArsMinor,
  summarizeCommissions,
  summarizeOwedByAffiliate,
} from "@/lib/affiliates/ui/presentation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    afiliado?: string;
    edicion?: string;
    ok?: string;
    error?: string;
  }>;
};

const STATUS_HELP: Record<(typeof COMMISSION_STATUS_ORDER)[number], string> = {
  PENDING: "Inscripciones con código que todavía no pagaron.",
  PAID_BY_SPLIT: "Mercado Pago ya se la pagó en el mismo cobro.",
  OWED: "Se cobró sin reparto: hay que transferírsela a mano.",
  PAID_OUT: "Ya se la transferimos.",
  REVERSED: "Reembolso, anulación o reserva vencida: no corresponde pagarla.",
};

function fecha(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(value);
}

export default async function AdminCommissionsPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const affiliateId = params.afiliado?.trim() || null;
  const editionId = params.edicion?.trim() || null;

  const returnQuery = new URLSearchParams();
  if (affiliateId) returnQuery.set("afiliado", affiliateId);
  if (editionId) returnQuery.set("edicion", editionId);

  const [rowsResult, affiliatesResult, editions] = await Promise.all([
    withClickatonDb(async () => listCommissionsForAdmin({ affiliateId, editionId })),
    withClickatonDb(async () => listAffiliateNames()),
    listEditionOptions(),
  ]);
  const editionOptions = editions.ok ? editions.data : [];
  const affiliates = affiliatesResult.ok ? affiliatesResult.data : [];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Comisiones de fotógrafos"
        description="Lo que ganó cada fotógrafo con su código: lo que Mercado Pago ya le pagó en el mismo cobro, lo que hay que transferirle y lo ya transferido."
        breadcrumbs={[{ label: "Comisiones de fotógrafos" }]}
      />

      <ActionResultMessage ok={params.ok} error={params.error} />

      <Card variant="outlined" className="p-5">
        <form method="get" className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="ck-label text-ck-text-secondary">Fotógrafo</span>
            <Select name="afiliado" defaultValue={affiliateId ?? ""} className="mt-1 min-h-11">
              <option value="">Todos</option>
              {affiliates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                  {!a.isActive ? " (desactivado)" : ""}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="ck-label text-ck-text-secondary">Edición</span>
            <Select name="edicion" defaultValue={editionId ?? ""} className="mt-1 min-h-11">
              <option value="">Todas</option>
              {editionOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary" className="min-h-11">
            Filtrar
          </Button>
          {affiliateId || editionId ? (
            <Button href={adminRoutes.commissions} variant="text" className="min-h-11">
              Ver todo
            </Button>
          ) : null}
        </form>
      </Card>

      {!rowsResult.ok ? (
        <AdminMigrationNotice message={rowsResult.message} />
      ) : (
        <CommissionsBody rows={rowsResult.data} returnQuery={returnQuery.toString()} />
      )}
    </div>
  );
}

type CommissionRow = Awaited<ReturnType<typeof listCommissionsForAdmin>>[number];

function CommissionsBody({ rows, returnQuery }: { rows: CommissionRow[]; returnQuery: string }) {
  const totals = summarizeCommissions(rows);
  const owed = summarizeOwedByAffiliate(
    rows.map((r) => ({
      status: r.status,
      netAmount: r.netAmount,
      affiliateId: r.affiliateId,
      affiliateName: r.affiliate.displayName,
    })),
  );

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COMMISSION_STATUS_ORDER.map((s) => (
          <Card key={s} className="space-y-1 p-5">
            <Badge variant={COMMISSION_STATUS_BADGE[s]}>{COMMISSION_STATUS_LABELS[s]}</Badge>
            <p className="pt-1 text-2xl font-bold">{formatArsMinor(totals[s].netAmount)}</p>
            <p className="text-xs text-ck-text-muted">
              {totals[s].count} {totals[s].count === 1 ? "inscripción" : "inscripciones"} ·{" "}
              {STATUS_HELP[s]}
            </p>
          </Card>
        ))}
      </section>

      {owed.length > 0 ? (
        <Card variant="outlined" className="space-y-3 p-5">
          <h2 className="text-lg font-semibold text-ck-text">A quién le debemos</h2>
          <ul className="space-y-1 text-sm">
            {owed.map((o) => (
              <li key={o.affiliateId}>
                <strong>{o.displayName}</strong>: le debemos {formatArsMinor(o.owedAmount)} (
                {o.owedCount} {o.owedCount === 1 ? "inscripción" : "inscripciones"})
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ck-text-secondary">Todavía no hay comisiones para mostrar.</p>
        </Card>
      ) : (
        <Card variant="outlined" className="overflow-x-auto p-0">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="border-b border-ck-border text-xs uppercase tracking-wide text-ck-text-muted">
              <tr>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Participante</th>
                <th className="px-3 py-3">Fotógrafo</th>
                <th className="px-3 py-3">Edición</th>
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3 text-right">Base</th>
                <th className="px-3 py-3 text-right">%</th>
                <th className="px-3 py-3 text-right">Bruto</th>
                <th className="px-3 py-3 text-right">Parte MP</th>
                <th className="px-3 py-3 text-right">Neto</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Motivo / referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ck-border align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-3">{fecha(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    {r.registration.firstName} {r.registration.lastName}
                    {r.registration.visibleCode ? (
                      <span className="block font-mono text-xs text-ck-text-muted">
                        {r.registration.visibleCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{r.affiliate.displayName}</td>
                  <td className="px-3 py-3">{r.edition.name}</td>
                  <td className="px-3 py-3 font-mono">{r.promotionCodeSnapshot}</td>
                  <td className="px-3 py-3 text-right">{formatArsMinor(r.baseAmount)}</td>
                  <td className="px-3 py-3 text-right">{formatCommissionBps(r.commissionBps)}</td>
                  <td className="px-3 py-3 text-right">{formatArsMinor(r.grossAmount)}</td>
                  <td className="px-3 py-3 text-right">{formatArsMinor(r.mpFeeShareAmount)}</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {formatArsMinor(r.netAmount)}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={commissionBadgeVariant(r.status)}>
                      {commissionStatusLabel(r.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {r.status === "OWED" ? (
                      <form action={markCommissionPaidOutAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="commissionId" value={r.id} />
                        <input type="hidden" name="returnQuery" value={returnQuery} />
                        <input
                          name="reference"
                          required
                          maxLength={200}
                          placeholder="Referencia de la transferencia"
                          aria-label="Referencia de la transferencia"
                          className="min-h-11 w-52 rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2"
                        />
                        <ConfirmSubmitButton
                          variant="secondary"
                          size="sm"
                          className="min-h-11"
                          confirmMessage={`¿Confirmás que le transferiste ${formatArsMinor(r.netAmount)} a ${r.affiliate.displayName}?`}
                        >
                          Marcar transferida
                        </ConfirmSubmitButton>
                      </form>
                    ) : r.status === "PAID_OUT" ? (
                      <span className="text-ck-text-secondary">
                        {r.paidOutReference ?? "—"} · {fecha(r.paidOutAt)}
                      </span>
                    ) : r.status === "REVERSED" ? (
                      <span className="text-ck-text-secondary">{r.reversalReason ?? "—"}</span>
                    ) : (
                      <span className="text-ck-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
