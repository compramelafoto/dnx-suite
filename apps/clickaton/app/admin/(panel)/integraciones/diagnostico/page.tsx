import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import {
  isPartnerSelfConnectEnabled,
  resolvePartnerOAuthEnvironment,
} from "@repo/payments";
import { getOwnerOAuthDiagnostics } from "@/lib/admin/mp-owner-oauth/runtime";
import { getPaymentsReconciliationDiagnostics } from "@/lib/checkout/application/run-payments-reconciliation-batch";
import { getEmailDeliveryDiagnostics } from "@/lib/registration/notifications/email-delivery";
import { prisma } from "@/lib/admin/db";
import { FINANCE_SEED_EMAILS } from "@/lib/admin/edition-finance/constants";
import {
  financeToneToBadgeVariant,
  presentConnectionStatusLabel,
  presentMpConnectionStatus,
  presentPaymentEnvironment,
  presentReconciliationDiagnostics,
} from "@/lib/admin/edition-finance/ui/finance-status-presentation";
import { presentAdminEmailQueueStatus } from "@/lib/admin-registration/ui/admin-status-presentation";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico admin seguro — sin secretos ni tokens.
 * Herramienta avanzada: capa operativa + técnica colapsable.
 */
export default async function IntegrationsDiagnosticsPage() {
  await requireClickatonAdmin({ returnTo: "/admin/integraciones/diagnostico" });

  const oauth = getOwnerOAuthDiagnostics();
  let emails: Awaited<ReturnType<typeof getEmailDeliveryDiagnostics>> | null = null;
  let reconcile: Awaited<
    ReturnType<typeof getPaymentsReconciliationDiagnostics>
  > | null = null;
  let loadError: string | null = null;
  let partnerDiag: {
    partnerOAuthEnabled: boolean;
    partnerEnvironment: string;
    ownerAccountStatus: string;
    tammyPartnerPermission: boolean;
    tammyPaymentAccount: string;
  } | null = null;

  try {
    [emails, reconcile] = await Promise.all([
      getEmailDeliveryDiagnostics(10),
      getPaymentsReconciliationDiagnostics(),
    ]);

    const ownerIdentity = await prisma.dnxFinancialIdentity.findFirst({
      where: { organizationRef: "clickaton:partners-production:mp-owner" },
      include: {
        paymentAccounts: {
          where: { status: { in: ["ACTIVE", "PENDING", "NEEDS_REAUTH", "REVOKED"] } },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    const tammy = await prisma.user.findFirst({
      where: { email: { equals: FINANCE_SEED_EMAILS.tammy, mode: "insensitive" } },
      select: { id: true },
    });
    const tammyGrant = tammy
      ? await prisma.dnxFinanceGrant.findFirst({
          where: {
            userId: tammy.id,
            capability: "DNX_FINANCE_PARTNER_CONNECT",
            status: "ACTIVE",
          },
        })
      : null;
    const tammyIdentity = tammy
      ? await prisma.dnxFinancialIdentity.findFirst({
          where: { ownerUserId: tammy.id, subjectType: "PERSON", status: "ACTIVE" },
          include: {
            paymentAccounts: {
              where: { status: { in: ["ACTIVE", "PENDING", "NEEDS_REAUTH"] } },
              take: 1,
            },
          },
        })
      : null;

    partnerDiag = {
      partnerOAuthEnabled: isPartnerSelfConnectEnabled(),
      partnerEnvironment: resolvePartnerOAuthEnvironment(),
      ownerAccountStatus: ownerIdentity?.paymentAccounts[0]?.status ?? "NONE",
      tammyPartnerPermission: Boolean(tammyGrant),
      tammyPaymentAccount: tammyIdentity?.paymentAccounts[0]?.status
        ? tammyIdentity.paymentAccounts[0].status
        : "NONE",
    };
  } catch {
    loadError = "No pudimos cargar el diagnóstico. Revisá la conexión e intentá nuevamente.";
  }

  const ownerConnection = presentMpConnectionStatus(
    partnerDiag?.ownerAccountStatus ?? "NOT_CONNECTED",
  );
  const env = presentPaymentEnvironment(oauth.mode);
  const recon = reconcile
    ? presentReconciliationDiagnostics({
        pendingPaymentOrders: reconcile.pendingPaymentOrders,
        recentErrors: reconcile.recentErrors,
        lastRunAt: reconcile.lastRunAt,
      })
    : null;

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Diagnóstico de integraciones"
        description="Vista avanzada para soporte: conexión con Mercado Pago, correos y verificación de pagos. No muestra secretos."
        breadcrumbs={[
          { label: "Integraciones", href: adminRoutes.integrations },
          { label: "Diagnóstico" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={financeToneToBadgeVariant(ownerConnection.tone)}>
              {ownerConnection.label}
            </Badge>
            <Badge variant={financeToneToBadgeVariant(env.tone)}>{env.label}</Badge>
          </div>
        }
      />

      <Card variant="outlined" className="border-ck-yellow/40 p-4 text-sm text-ck-text-secondary">
        Esta pantalla es para diagnóstico técnico. Para operar cobros usá Finanzas de la
        edición y las pantallas de cuenta de Mercado Pago.
      </Card>

      {loadError ? (
        <Card variant="outlined" className="p-4 text-sm text-ck-text-secondary" role="alert">
          {loadError}
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-3 p-5 text-sm md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">
          Conexión con Mercado Pago
        </h2>
        <p className="text-ck-text-secondary">{ownerConnection.description}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">¿Puede iniciar conexión?</dt>
            <dd>{oauth.canStartLiveOwnerOAuth ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Aplicación configurada</dt>
            <dd>{oauth.appConfigured ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Onboarding habilitado</dt>
            <dd>{oauth.onboardingEnabled ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Autorización manual</dt>
            <dd>{oauth.manualAuthorized ? "Confirmada" : "Pendiente"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Almacenamiento seguro de credenciales</dt>
            <dd>{oauth.vaultAvailable ? "Disponible" : "No disponible"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Entorno</dt>
            <dd>{env.label}</dd>
          </div>
        </dl>
      </Card>

      <Card variant="outlined" className="space-y-3 p-5 text-sm md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">
          Cuentas personales de cobro
        </h2>
        {partnerDiag ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-ck-text-muted">Cuenta principal</dt>
              <dd>{presentConnectionStatusLabel(partnerDiag.ownerAccountStatus)}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Conexión personal habilitada</dt>
              <dd>{partnerDiag.partnerOAuthEnabled ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Entorno de conexión personal</dt>
              <dd>{presentPaymentEnvironment(partnerDiag.partnerEnvironment).label}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Permiso de cobro (Tammy)</dt>
              <dd>{partnerDiag.tammyPartnerPermission ? "Activo" : "Inactivo"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Cuenta de cobro (Tammy)</dt>
              <dd>{presentConnectionStatusLabel(partnerDiag.tammyPaymentAccount)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-ck-text-muted">No hay datos de cuentas personales.</p>
        )}
      </Card>

      <Card variant="outlined" className="space-y-3 p-5 text-sm md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">Correos enviados</h2>
        {emails ? (
          <>
            <p>
              Preparando envío: {emails.pending} · Enviados: {emails.sent} · Con
              problema: {emails.failed}
            </p>
            <ul className="space-y-2">
              {emails.recent.map((r) => {
                const emailStatus = presentAdminEmailQueueStatus(r.status);
                return (
                  <li key={r.id} className="border-t border-ck-border pt-2">
                    <span className="font-medium text-ck-text">{emailStatus.label}</span>
                    {" · "}
                    {r.toMasked} · {r.attempts} intento{r.attempts === 1 ? "" : "s"}
                    {r.lastError ? (
                      <span className="mt-1 block text-xs text-ck-text-muted">
                        No pudimos completar este envío. Revisá la dirección o la información
                        técnica.
                      </span>
                    ) : null}
                  </li>
                );
              })}
              {emails.recent.length === 0 ? (
                <li className="text-ck-text-muted">No hay correos con actividad reciente</li>
              ) : null}
            </ul>
          </>
        ) : (
          <p className="text-ck-text-muted">No disponible</p>
        )}
      </Card>

      <Card variant="outlined" className="space-y-3 p-5 text-sm md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">
          Verificación de pagos
        </h2>
        <p className="text-ck-text-secondary">
          Comparamos los registros de Clickatón con la información recibida de Mercado Pago
          para detectar diferencias.
        </p>
        {reconcile && recon ? (
          <>
            <Badge variant={financeToneToBadgeVariant(recon.tone)}>{recon.label}</Badge>
            <p className="text-ck-text-secondary">{recon.description}</p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-ck-text-muted">Última verificación</dt>
                <dd>{reconcile.lastRunAt ?? "Nunca"}</dd>
              </div>
              <div>
                <dt className="text-ck-text-muted">Errores recientes (24 h)</dt>
                <dd>{reconcile.recentErrors}</dd>
              </div>
              <div>
                <dt className="text-ck-text-muted">Pagos pendientes de verificación</dt>
                <dd>{reconcile.pendingPaymentOrders}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-ck-text-muted">No disponible</p>
        )}
      </Card>

      <AdminTechnicalInfo
        title="Información técnica — Diagnóstico"
        description="Detalle avanzado para soporte. Incluye rutas y flags internos. Sin secretos."
        rows={[
          { label: "Ruta de retorno", value: oauth.callbackRoute, mono: true },
          {
            label: "Servicio de intercambio",
            value: oauth.exchangeServiceAvailable ? "Disponible" : "No",
          },
          {
            label: "URL de retorno",
            value: oauth.redirectUri,
            mono: true,
            copyText: oauth.redirectUri,
          },
          {
            label: "URL coincide con producción",
            value: oauth.redirectExactMatchProduction ? "sí" : "no",
          },
          { label: "Modo interno", value: oauth.mode, mono: true },
          {
            label: "Cron de verificación",
            value: "/api/cron/payments-reconciliation (*/10)",
            mono: true,
          },
          {
            label: "Estado interno cuenta principal",
            value: partnerDiag?.ownerAccountStatus ?? "NONE",
            mono: true,
          },
          {
            label: "Estado interno cuenta Tammy",
            value: partnerDiag?.tammyPaymentAccount ?? "NONE",
            mono: true,
          },
        ]}
      />
    </div>
  );
}
