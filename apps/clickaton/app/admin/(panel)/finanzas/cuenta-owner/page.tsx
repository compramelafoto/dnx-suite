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
  type OwnerPanelViewModel,
} from "@repo/payments";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { OwnerMpConnectActions } from "@/components/admin/OwnerMpConnectActions";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import { createOwnerOAuthRuntime } from "@/lib/admin/mp-owner-oauth/runtime";
import { adminRoutes } from "@/config/admin/navigation";

export const dynamic = "force-dynamic";

async function loadOwnerPanel(
  userId: number,
): Promise<OwnerPanelViewModel | null> {
  try {
    const actor = await loadFinanceActor(userId);
    const { service } = createOwnerOAuthRuntime();
    return await service.getPanelView(actor);
  } catch {
    return null;
  }
}

/**
 * Owner MP panel — behind DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED (default OFF).
 * Never shows tokens / full provider IDs / secrets.
 */
export default async function OwnerMpAccountPage() {
  const user = await requireClickatonAdmin({
    returnTo: "/admin/finanzas/cuenta-owner",
  });

  if (!isOwnerOnboardingEnabled()) {
    notFound();
  }

  const app = readClickatonMpOAuthAppConfig();
  const panel = await loadOwnerPanel(user.id);
  const connected = Boolean(
    panel &&
      (panel.status === "ACTIVE" ||
        panel.status === "VERIFIED" ||
        panel.status === "CONNECTED_UNVERIFIED" ||
        panel.status === "OAUTH_PENDING"),
  );
  const readiness = hydrateClickatonProductionPaymentReadiness({
    ownerAccount: null,
    env: process.env,
  });
  const manual = isOwnerOAuthManuallyAuthorized();
  const connectEnabled = app.configured && manual;

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
          {connected
            ? "Cuenta owner conectada"
            : OWNER_PANEL_UI_MESSAGES.notConnected}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          {(panel?.messages?.length
            ? panel.messages
            : [
                OWNER_PANEL_UI_MESSAGES.noCharges,
                OWNER_PANEL_UI_MESSAGES.partnersPending,
                OWNER_PANEL_UI_MESSAGES.ordersOff,
                OWNER_PANEL_UI_MESSAGES.distributionUnpublished,
                ...(!manual ? [OWNER_PANEL_UI_MESSAGES.awaitManualAuth] : []),
              ]
          ).map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      </Card>

      <Card variant="outlined" className="space-y-3 text-sm">
        <h2 className="text-base font-semibold text-ck-text-primary">Estado</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Entorno</dt>
            <dd>{panel?.environment ?? "LIVE / PROD (objetivo)"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Cuenta</dt>
            <dd>
              {connected
                ? `Conectada${panel?.accountMasked ? ` (${panel.accountMasked})` : ""}`
                : "No conectada"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Estado OAuth</dt>
            <dd>{panel?.status ?? "NOT_CONNECTED"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">App MP dedicada</dt>
            <dd>
              {app.configured
                ? "Credenciales presentes"
                : `Faltan: ${app.missing.join(", ")}`}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Application ID (client_id)</dt>
            <dd className="font-mono text-xs break-all">
              {process.env.CLICKATON_MP_CLIENT_ID?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Redirect URI que enviamos</dt>
            <dd className="font-mono text-xs break-all">
              {app.redirectUri || CLICKATON_MP_REDIRECTS.production}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">PKCE en authorize</dt>
            <dd>
              {(process.env.CLICKATON_MP_OAUTH_USE_PKCE ?? "true").trim() ===
              "false"
                ? "OFF"
                : "ON"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Autorización manual OAuth</dt>
            <dd>{manual ? "Presente" : "Pendiente"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Readiness dry-run</dt>
            <dd>{readiness.readyForDryRun ? "sí" : "no"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ck-text-muted">Bloqueos</dt>
            <dd className="break-words">
              {readiness.blockers.join(", ") || "ninguno"}
            </dd>
          </div>
        </dl>
      </Card>

      {!connected ? (
        <Card variant="outlined" className="space-y-3 text-sm border-amber-500/40 bg-amber-500/5">
          <h2 className="text-base font-semibold text-ck-text-primary">
            Si Mercado Pago dice “aplicación no preparada”
          </h2>
          <p className="text-ck-text-secondary">
            Ese mensaje lo muestra Mercado Pago Developers, no Clickatón. En la
            app cuyo Application ID coincide con el de arriba, en{" "}
            <strong>Editar → URLs de redireccionamiento</strong>, cargá
            exactamente:
          </p>
          <p className="font-mono text-xs break-all text-ck-text-primary">
            {app.redirectUri || CLICKATON_MP_REDIRECTS.production}
          </p>
          <ul className="list-disc space-y-2 pl-5 text-ck-text-secondary">
            <li>Sin barra final, sin www, https exacto.</li>
            <li>
              Si en esa app tenés PKCE habilitado, en Vercel debe estar{" "}
              <code>CLICKATON_MP_OAUTH_USE_PKCE=true</code> (ahora está OFF).
            </li>
            <li>
              Si PKCE está deshabilitado en MP, dejá el flag en false (estado
              actual).
            </li>
            <li>Guardá la app y reintentá “Conectar Mercado Pago”.</li>
          </ul>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-4 text-sm">
        <h2 className="text-base font-semibold text-ck-text-primary">
          {connected ? "Cuenta Mercado Pago" : "Conectar Mercado Pago"}
        </h2>
        <OwnerMpConnectActions
          connected={connected}
          canConnect={panel?.canConnect ?? true}
          canRevoke={panel?.canRevoke ?? false}
          canReconnect={panel?.canReconnect ?? false}
          connectEnabled={connectEnabled}
          accountMasked={panel?.accountMasked ?? null}
        />
        {panel === null ? (
          <p className="text-xs text-ck-text-muted">
            Solo un usuario con permiso DNX_FINANCE_OWNER puede conectar o
            desconectar la cuenta owner.
          </p>
        ) : null}
      </Card>

      <Card variant="outlined" className="space-y-2 text-sm text-ck-text-muted">
        <p>Redirects documentados (configurar en panel MP):</p>
        <p className="font-mono text-xs break-all">
          {CLICKATON_MP_REDIRECTS.staging}
        </p>
        <p className="font-mono text-xs break-all">
          {CLICKATON_MP_REDIRECTS.production}
        </p>
        <p className="pt-2">Notification URLs:</p>
        <p className="font-mono text-xs break-all">
          {CLICKATON_MP_NOTIFICATION_URLS.staging}
        </p>
        <p className="font-mono text-xs break-all">
          {CLICKATON_MP_NOTIFICATION_URLS.production}
        </p>
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
