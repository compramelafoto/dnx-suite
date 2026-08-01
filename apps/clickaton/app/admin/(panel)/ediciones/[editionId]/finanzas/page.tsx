import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
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
import {
  buildEditionFinanceChecklist,
  financeToneToBadgeVariant,
  presentConnectionStatusLabel,
  presentDistributionVersionStatus,
  presentEditionFinanceOverall,
  presentFinanceGateBlocker,
  presentFinanceGateWarning,
  presentPaymentEnvironment,
  presentWebhookReadiness,
  sanitizeFinanceErrorText,
} from "@/lib/admin/edition-finance/ui/finance-status-presentation";
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

  const overall = presentEditionFinanceOverall({
    readiness: data.readiness,
    gate: data.gate,
  });
  const checklist = buildEditionFinanceChecklist({
    readiness: data.readiness,
    gate: data.gate,
  });
  const env = presentPaymentEnvironment(data.readiness.accountMode);
  const webhook = presentWebhookReadiness(data.readiness.webhookReady);
  const primaryHref =
    !data.readiness.paymentAccountConnected || !data.readiness.oauthLikelyValid
      ? adminRoutes.financePartner
      : null;

  const flashError = sanitizeFinanceErrorText(flash.financeError);

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Finanzas de la edición"
        description="Revisá la cuenta que recibirá los pagos, la distribución y el estado de los cobros."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Finanzas" },
        ]}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Badge variant={financeToneToBadgeVariant(overall.tone)}>{overall.label}</Badge>
            <Badge variant={financeToneToBadgeVariant(env.tone)}>{env.label}</Badge>
            {primaryHref ? (
              <Button href={primaryHref} variant="primary" className="min-h-11 w-full sm:w-auto">
                Revisar conexión
              </Button>
            ) : null}
            <Button
              href={`${adminRoutes.editions}/${editionId}`}
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
            >
              Volver a la edición
            </Button>
          </div>
        }
      />

      {flashError ? (
        <Card
          variant="outlined"
          className="border-[var(--ck-danger)]/40 text-sm text-[var(--ck-danger)]"
          role="alert"
        >
          {flashError}
        </Card>
      ) : null}
      {flash.financeOk ? (
        <Card
          variant="outlined"
          className="border-emerald-500/40 text-sm text-emerald-300"
          role="status"
        >
          {flash.financeOk}
        </Card>
      ) : null}

      {/* Estado general */}
      <Card variant="outlined" className="min-w-0 space-y-4 border-ck-yellow/40 p-5 md:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Estado financiero</h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">{overall.description}</p>
          {overall.nextAction ? (
            <p className="text-sm font-medium text-ck-text">Próximo paso: {overall.nextAction}</p>
          ) : null}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <dt className="text-sm text-ck-text-secondary">Cuenta que recibirá los pagos</dt>
            <dd className="break-words text-sm font-medium">
              {data.readiness.beneficiaryLabel === "—"
                ? "Todavía no definida"
                : data.readiness.beneficiaryLabel}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm text-ck-text-secondary">Situación de la conexión</dt>
            <dd className="text-sm">
              {data.readiness.paymentAccountConnected
                ? data.readiness.oauthLikelyValid
                  ? "Conectada y autorizada"
                  : "Conectada · necesita actualizarse"
                : "Sin conectar"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm text-ck-text-secondary">Distribución</dt>
            <dd className="text-sm">
              {data.readiness.sumOk ? (
                <Badge variant="success">Suma 100 %</Badge>
              ) : (
                <Badge variant="danger">Debe sumar 100 %</Badge>
              )}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm text-ck-text-secondary">Actualizaciones de pagos</dt>
            <dd className="text-sm">{webhook.label}</dd>
          </div>
        </dl>
        {!overall.isReadyForPayments ? (
          <p
            className="rounded-[var(--ck-radius-card)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            role="status"
          >
            Esta edición todavía no está lista para cobrar con seguridad. Resolvé los
            bloqueos antes de abrir inscripciones reales.
          </p>
        ) : null}
        {/* FINANCE_REVIEW: reembolsos / ledger — no afirmar obligaciones fiscales */}
        <p className="text-xs text-ck-text-muted">
          Los reembolsos y la liquidación completa entre partes pueden requerir revisión
          operativa adicional. Esta pantalla no define obligaciones fiscales.{" "}
          <span className="font-mono">FINANCE_REVIEW</span>
        </p>
      </Card>

      {/* Checklist */}
      <section className="space-y-4" aria-labelledby="finance-checklist-heading">
        <h2 id="finance-checklist-heading" className="text-lg font-semibold">
          Preparación para cobrar
        </h2>
        <ul className="grid gap-3">
          {checklist.map((item) => (
            <li
              key={item.id}
              className="min-w-0 rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-ck-text">{item.label}</p>
                <Badge variant={item.ok ? "success" : "warning"}>
                  {item.ok ? "Listo" : "Pendiente"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-ck-text-secondary">{item.description}</p>
              {item.nextAction ? (
                <p className="mt-2 text-sm font-medium text-ck-text">{item.nextAction}</p>
              ) : null}
            </li>
          ))}
        </ul>
        {data.canManage ? (
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <form action={validateEditionFinanceConfigFormAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
                Validar configuración
              </Button>
            </form>
            <form action={dryRunEditionCheckoutPlanFormAction.bind(null, editionId)}>
              <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
                Probar preparación de cobro
              </Button>
            </form>
          </div>
        ) : null}
      </section>

      {/* Bloqueos */}
      <Card variant="outlined" className="min-w-0 space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Bloqueos y avisos</h2>
        <p className="text-sm text-ck-text-secondary">
          Entorno evaluado:{" "}
          <strong>{data.gate.mode === "LIVE" ? "Pagos reales" : "Pruebas"}</strong>
          {" · "}
          {data.gate.ok ? (
            <Badge variant="success">Sin bloqueos</Badge>
          ) : (
            <Badge variant="danger">Hay bloqueos</Badge>
          )}
        </p>
        {data.gate.blockers.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--ck-danger)]">
            {data.gate.blockers.map((b) => {
              const presented = presentFinanceGateBlocker(b);
              return (
                <li key={b}>
                  {presented.label}
                  {presented.nextAction ? (
                    <span className="mt-1 block text-ck-text-secondary">
                      {presented.nextAction}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ck-text-muted">No hay bloqueos en esta verificación.</p>
        )}
        {data.gate.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
            {data.gate.warnings.map((w) => (
              <li key={w}>{presentFinanceGateWarning(w)}</li>
            ))}
          </ul>
        ) : null}
        {!data.canManage ? (
          <p className="text-sm text-ck-text-secondary">
            Solo lectura: no tenés permiso para modificar la distribución financiera de esta
            edición.
          </p>
        ) : null}
        {data.readiness.lastError ? (
          <p className="text-sm text-amber-700" role="status">
            Último aviso de conexión:{" "}
            {sanitizeFinanceErrorText(data.readiness.lastError) ??
              "Revisá la cuenta receptora."}
          </p>
        ) : null}
      </Card>

      {/* Distribución activa */}
      <section className="space-y-4" aria-labelledby="active-distribution-heading">
        <div className="space-y-2">
          <h2 id="active-distribution-heading" className="text-lg font-semibold">
            Distribución de los pagos
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Definí qué porcentaje recibirá cada cuenta cuando se confirme un pago.
            {/* FINANCE_REVIEW */}
          </p>
        </div>
        {!data.active ? (
          <Card variant="outlined" className="p-5">
            <p className="font-medium text-ck-text">No hay distribución publicada</p>
            <p className="mt-2 text-sm text-ck-text-secondary">
              Creá un borrador y publicá la distribución para que esta edición pueda recibir
              pagos.
            </p>
          </Card>
        ) : (
          <Card variant="outlined" className="min-w-0 space-y-4 p-5 md:p-6">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="success">
                {presentDistributionVersionStatus("ACTIVE").label} · v{data.active.version}
              </Badge>
              {!data.readiness.sumOk ? (
                <Badge variant="danger">La distribución debe sumar 100 %</Badge>
              ) : null}
            </div>
            {data.active.allocations.length === 1 &&
            data.active.allocations[0]?.shareValue === 100 ? (
              <p className="text-sm font-medium text-ck-text">
                {data.active.allocations[0].beneficiaryDisplayName} recibirá el 100 % de los
                pagos de esta edición.
                {/* FINANCE_REVIEW: titularidad / liquidación */}
              </p>
            ) : null}

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-0 text-left text-sm">
                <thead className="text-ck-text-secondary">
                  <tr>
                    <th scope="col" className="py-2 pr-3">
                      Cuenta
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Participación
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Conexión
                    </th>
                    <th scope="col" className="py-2">
                      Entorno
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.active.allocations.map((a) => {
                    const connEnv = presentPaymentEnvironment(
                      a.paymentConnection?.environment,
                    );
                    return (
                      <tr key={a.id} className="border-t border-ck-border">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{a.beneficiaryDisplayName}</div>
                          <div className="text-xs text-ck-text-muted">
                            {a.beneficiaryEmailMasked ?? "Email no informado"}
                          </div>
                        </td>
                        <td className="py-3 pr-3">{a.shareValue} %</td>
                        <td className="py-3 pr-3">
                          {presentConnectionStatusLabel(a.paymentConnection?.status)}
                        </td>
                        <td className="py-3">{connEnv.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="grid gap-3 md:hidden">
              {data.active.allocations.map((a) => {
                const connEnv = presentPaymentEnvironment(a.paymentConnection?.environment);
                return (
                  <li
                    key={a.id}
                    className="min-w-0 space-y-2 rounded-[var(--ck-radius-card)] border border-ck-border p-4"
                  >
                    <p className="font-semibold text-ck-text">{a.beneficiaryDisplayName}</p>
                    <p className="text-sm text-ck-text-secondary">
                      {a.beneficiaryEmailMasked ?? "Email no informado"}
                    </p>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-ck-text-muted">Participación</dt>
                        <dd>{a.shareValue} %</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ck-text-muted">Conexión</dt>
                        <dd>{presentConnectionStatusLabel(a.paymentConnection?.status)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-ck-text-muted">Entorno</dt>
                        <dd>{connEnv.label}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* Versiones */}
      <section className="space-y-4" aria-labelledby="versions-heading">
        <h2 id="versions-heading" className="text-lg font-semibold">
          Versiones de la distribución
        </h2>
        {data.distributions.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Todavía no hay versiones de distribución.</p>
        ) : (
          <ul className="space-y-3">
            {data.distributions.map((d) => {
              const versionStatus = presentDistributionVersionStatus(d.versionStatus);
              return (
                <li
                  key={`${d.id}-${d.versionId}`}
                  className="flex min-w-0 flex-col gap-3 rounded-[var(--ck-radius-card)] border border-ck-border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p>
                      <strong>Versión {d.version}</strong>
                      {" · "}
                      <Badge variant={financeToneToBadgeVariant(versionStatus.tone)}>
                        {versionStatus.label}
                      </Badge>
                    </p>
                    <p className="break-words text-ck-text-secondary">
                      {d.allocations
                        .map((a) => `${a.beneficiaryDisplayName} ${a.shareValue} %`)
                        .join(" · ")}
                    </p>
                  </div>
                  {data.canMutate && d.versionStatus === "DRAFT" && d.versionId ? (
                    <div className="w-full space-y-2 sm:w-auto sm:text-right">
                      {!draftCanActivate ? (
                        <p className="max-w-xs text-xs text-amber-700">
                          Para publicar, cada cuenta del borrador necesita Mercado Pago
                          conectado y autorizado.
                        </p>
                      ) : null}
                      <form
                        action={activateEditionDistributionFormAction.bind(null, editionId)}
                      >
                        <input type="hidden" name="versionId" value={d.versionId} />
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={!draftCanActivate}
                          className="min-h-11 w-full sm:w-auto"
                        >
                          Publicar distribución
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.canMutate ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {openDraft ? "Editar borrador de distribución" : "Crear borrador de distribución"}
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
          Podés consultar la configuración, pero solo quien administra finanzas de la suite
          puede editar porcentajes y cuentas receptoras.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historial de cambios</h2>
        {data.audits.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Sin eventos todavía.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.audits.map((a) => (
              <li key={a.id} className="border-b border-ck-border/60 py-2">
                <span className="text-ck-text-muted">
                  {a.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                </span>
                {" · "}
                {a.action}
                {a.actorUserId ? ` · operador #${a.actorUserId}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminTechnicalInfo
        description="Referencias para soporte. No son necesarias para la operación diaria. Sin tokens ni secretos."
        rows={[
          {
            label: "Estado interno de distribución",
            value: data.readiness.distributionStatus,
            mono: true,
          },
          {
            label: "Proveedor de checkout",
            value: data.readiness.checkoutProvider ?? "No informado",
            mono: true,
          },
          {
            label: "Modo de cuenta (crudo)",
            value: data.readiness.accountMode,
            mono: true,
          },
          {
            label: "Actualizaciones automáticas configuradas",
            value: data.readiness.webhookReady ? "sí" : "no",
          },
          {
            label: "Reembolsos (estado operativo interno)",
            value: data.readiness.refundsBlocked ? "bloqueados" : "habilitados",
          },
          {
            label: "Registro contable interno completo",
            value: data.readiness.ledgerCompletePending ? "pendiente" : "completo",
          },
          {
            label: "IDs de conexión de cobro",
            value:
              data.active?.allocations
                .map((a) => a.paymentConnectionId ?? "sin-conexión")
                .join(" · ") ?? "Sin distribución activa",
            mono: true,
          },
          {
            label: "Política de comisiones (interna)",
            value: data.active?.feePolicy ?? "No informada",
            mono: true,
          },
          {
            label: "Política de redondeo (interna)",
            value: data.active?.roundingPolicy ?? "No informada",
            mono: true,
          },
          {
            label: "ID de acuerdo activo",
            value: data.active?.id ?? "Sin acuerdo",
            mono: true,
            copyText: data.active?.id,
          },
        ]}
      />
    </div>
  );
}
