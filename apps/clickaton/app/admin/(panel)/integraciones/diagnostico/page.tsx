import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { getOwnerOAuthDiagnostics } from "@/lib/admin/mp-owner-oauth/runtime";
import { getPaymentsReconciliationDiagnostics } from "@/lib/checkout/application/run-payments-reconciliation-batch";
import { getEmailDeliveryDiagnostics } from "@/lib/registration/notifications/email-delivery";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico admin seguro — sin secretos ni tokens.
 */
export default async function IntegrationsDiagnosticsPage() {
  await requireClickatonAdmin({ returnTo: "/admin/integraciones/diagnostico" });

  const oauth = getOwnerOAuthDiagnostics();
  let emails: Awaited<ReturnType<typeof getEmailDeliveryDiagnostics>> | null = null;
  let reconcile: Awaited<
    ReturnType<typeof getPaymentsReconciliationDiagnostics>
  > | null = null;
  let loadError: string | null = null;

  try {
    [emails, reconcile] = await Promise.all([
      getEmailDeliveryDiagnostics(10),
      getPaymentsReconciliationDiagnostics(),
    ]);
  } catch {
    loadError = "No se pudieron cargar métricas de DB (¿DATABASE_URL alcanzable?)";
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Diagnóstico de integraciones"
        description="Estado operativo sanitizado: OAuth MP, emails y reconciliación. Sin secretos."
        breadcrumbs={[
          { label: "Integraciones", href: adminRoutes.integrations },
          { label: "Diagnóstico" },
        ]}
      />

      {loadError ? (
        <Card variant="outlined" className="text-sm text-ck-text-secondary">
          {loadError}
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-3 text-sm">
        <h2 className="text-base font-semibold text-ck-text-primary">Mercado Pago OAuth</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Callback</dt>
            <dd>{oauth.callbackRoute}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Exchange service</dt>
            <dd>{oauth.exchangeServiceAvailable ? "Disponible" : "No"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Vault</dt>
            <dd>{oauth.vaultAvailable ? "Master key presente" : "Ausente"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Redirect URI</dt>
            <dd className="break-all">{oauth.redirectUri}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Modo</dt>
            <dd>{oauth.mode}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Onboarding flag</dt>
            <dd>{oauth.onboardingEnabled ? "ON" : "OFF"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">App MP configurada</dt>
            <dd>{oauth.appConfigured ? "Sí (ids presentes)" : "No"}</dd>
          </div>
        </dl>
      </Card>

      <Card variant="outlined" className="space-y-3 text-sm">
        <h2 className="text-base font-semibold text-ck-text-primary">Emails</h2>
        {emails ? (
          <>
            <p>
              Pendientes: {emails.pending} · Enviados: {emails.sent} · Fallidos:{" "}
              {emails.failed}
            </p>
            <ul className="space-y-2">
              {emails.recent.map((r) => (
                <li key={r.id} className="border-t border-ck-border pt-2">
                  #{r.id} · {r.status} · {r.toMasked} · intentos {r.attempts}
                  {r.lastError ? ` · ${r.lastError.slice(0, 80)}` : ""}
                </li>
              ))}
              {emails.recent.length === 0 ? (
                <li className="text-ck-text-muted">Sin entregas Clickatón recientes</li>
              ) : null}
            </ul>
          </>
        ) : (
          <p className="text-ck-text-muted">No disponible</p>
        )}
      </Card>

      <Card variant="outlined" className="space-y-3 text-sm">
        <h2 className="text-base font-semibold text-ck-text-primary">
          Reconciliación de pagos
        </h2>
        {reconcile ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-ck-text-muted">Último run (audit)</dt>
              <dd>{reconcile.lastRunAt ?? "Nunca"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Errores 24h</dt>
              <dd>{reconcile.recentErrors}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Órdenes pendientes de reconcile</dt>
              <dd>{reconcile.pendingPaymentOrders}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Cron</dt>
              <dd>/api/cron/payments-reconciliation (*/10)</dd>
            </div>
          </dl>
        ) : (
          <p className="text-ck-text-muted">No disponible</p>
        )}
      </Card>
    </div>
  );
}
