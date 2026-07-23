import { notFound } from "next/navigation";
import {
  CLICKATON_MP_NOTIFICATION_URLS,
  CLICKATON_MP_REDIRECTS,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  OWNER_PANEL_UI_MESSAGES,
  hydrateClickatonProductionPaymentReadiness,
  isOwnerOnboardingEnabled,
  isOwnerOAuthManuallyAuthorized,
  readClickatonMpOAuthAppConfig,
} from "@repo/payments";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";

export const dynamic = "force-dynamic";

/**
 * Owner MP panel — behind DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED (default OFF).
 * Never shows tokens / full provider IDs / secrets.
 */
export default async function OwnerMpAccountPage() {
  await requireClickatonAdmin({ returnTo: "/admin/finanzas/cuenta-owner" });

  if (!isOwnerOnboardingEnabled()) {
    notFound();
  }

  const app = readClickatonMpOAuthAppConfig();
  const readiness = hydrateClickatonProductionPaymentReadiness({
    ownerAccount: null,
    env: process.env,
  });
  const manual = isOwnerOAuthManuallyAuthorized();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Cuenta owner Mercado Pago"
        description="Conexión de la cuenta exclusiva de Clickatón. No activa cobros ni Orders productivo."
        breadcrumbs={[
          { label: "Integraciones", href: adminRoutes.integrations },
          { label: "Cuenta owner" },
        ]}
      />

      <Card variant="outlined" className="space-y-4 text-sm text-ck-text-secondary">
        <p className="font-medium text-ck-text-primary">
          {OWNER_PANEL_UI_MESSAGES.notConnected}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{OWNER_PANEL_UI_MESSAGES.noCharges}</li>
          <li>{OWNER_PANEL_UI_MESSAGES.partnersPending}</li>
          <li>{OWNER_PANEL_UI_MESSAGES.ordersOff}</li>
          <li>{OWNER_PANEL_UI_MESSAGES.distributionUnpublished}</li>
          {!manual ? <li>{OWNER_PANEL_UI_MESSAGES.awaitManualAuth}</li> : null}
        </ul>
      </Card>

      <Card variant="outlined" className="space-y-3 text-sm">
        <h2 className="text-base font-semibold text-ck-text-primary">Estado</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Entorno</dt>
            <dd>LIVE / PROD (objetivo)</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Cuenta</dt>
            <dd>No conectada</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">App MP dedicada</dt>
            <dd>{app.configured ? "Credenciales presentes" : `Faltan: ${app.missing.join(", ")}`}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Autorización manual OAuth</dt>
            <dd>{manual ? "Presente" : "Pendiente"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Readiness dry-run</dt>
            <dd>{readiness.readyForDryRun ? "sí" : "no"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Bloqueos</dt>
            <dd className="break-words">{readiness.blockers.join(", ") || "ninguno"}</dd>
          </div>
        </dl>
      </Card>

      <Card variant="outlined" className="space-y-2 text-sm text-ck-text-muted">
        <p>Redirects documentados (configurar en panel MP):</p>
        <p className="font-mono text-xs break-all">{CLICKATON_MP_REDIRECTS.staging}</p>
        <p className="font-mono text-xs break-all">{CLICKATON_MP_REDIRECTS.production}</p>
        <p className="pt-2">Notification URLs:</p>
        <p className="font-mono text-xs break-all">{CLICKATON_MP_NOTIFICATION_URLS.staging}</p>
        <p className="font-mono text-xs break-all">{CLICKATON_MP_NOTIFICATION_URLS.production}</p>
        <p className="pt-4 text-ck-text-secondary">
          Para autorizar OAuth real, Daniel debe confirmar exactamente:
        </p>
        <p className="font-mono text-xs text-ck-text-primary">
          {OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE}
        </p>
      </Card>
    </div>
  );
}
