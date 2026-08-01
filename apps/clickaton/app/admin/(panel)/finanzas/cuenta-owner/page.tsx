import Link from "next/link";
import {
  CLICKATON_MP_NOTIFICATION_URLS,
  CLICKATON_MP_REDIRECTS,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  OWNER_PANEL_UI_MESSAGES,
  hydrateClickatonProductionPaymentReadiness,
  isClickatonMpOAuthPkceEnabled,
  isOwnerOnboardingEnabled,
  isOwnerOAuthManuallyAuthorized,
  readClickatonMpOAuthAppConfig,
  type OwnerPanelViewModel,
} from "@repo/payments";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { OwnerMpConnectActions } from "@/components/admin/OwnerMpConnectActions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  financeToneToBadgeVariant,
  presentMpConnectionStatus,
  presentPaymentEnvironment,
} from "@/lib/admin/edition-finance/ui/finance-status-presentation";
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
    return (
      <div className="min-w-0 space-y-8">
        <AdminPageHeader
          title="Cuenta que recibirá los pagos"
          description="Administrá la cuenta receptora de los pagos cuando esta función esté habilitada."
          breadcrumbs={[
            { label: "Finanzas", href: adminRoutes.financeOwner },
            { label: "Cuenta receptora" },
          ]}
        />
        <Card variant="outlined" className="space-y-4 p-5 text-sm text-ck-text-secondary md:p-6">
          <h2 className="text-base font-semibold text-ck-text-primary">
            Panel de cuenta receptora no habilitado
          </h2>
          <p>
            Este panel estará disponible cuando se habilite la función de incorporación de
            la cuenta receptora. No se modificó ninguna configuración de cobro.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={adminRoutes.financePartner}
              className="inline-flex min-h-11 items-center rounded-md border border-ck-border px-4 font-medium text-ck-text-primary hover:border-ck-yellow hover:text-ck-yellow"
            >
              Ir a Mi cuenta de cobro
            </Link>
            <Link
              href="/admin/integraciones/diagnostico"
              className="inline-flex min-h-11 items-center rounded-md border border-ck-border px-4 font-medium text-ck-text-primary hover:border-ck-yellow hover:text-ck-yellow"
            >
              Ver diagnóstico de integraciones
            </Link>
          </div>
        </Card>
      </div>
    );
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
  const connection = presentMpConnectionStatus(panel?.status ?? "NOT_CONNECTED");
  const environment = presentPaymentEnvironment(panel?.environment ?? "LIVE");
  const pkceOn = isClickatonMpOAuthPkceEnabled();

  const operationalMessages = (
    panel?.messages?.length
      ? panel.messages
      : [
          OWNER_PANEL_UI_MESSAGES.noCharges,
          OWNER_PANEL_UI_MESSAGES.partnersPending,
          OWNER_PANEL_UI_MESSAGES.ordersOff,
          OWNER_PANEL_UI_MESSAGES.distributionUnpublished,
          ...(!manual
            ? [
                "La conexión real está bloqueada hasta una autorización manual explícita del responsable.",
              ]
            : []),
        ]
  ).map((msg) =>
    msg
      .replace(/OAuth real/gi, "conexión real")
      .replace(/collector/gi, "receptora")
      .replace(/\bOrders\b/g, "Cobros productivos"),
  );

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Cuenta que recibirá los pagos"
        description="Conectá la cuenta de Mercado Pago de Clickatón. Esta pantalla no activa cobros por sí sola."
        breadcrumbs={[
          { label: "Finanzas", href: adminRoutes.financeOwner },
          { label: "Cuenta receptora" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={financeToneToBadgeVariant(connection.tone)}>
              {connection.label}
            </Badge>
            <Badge variant={financeToneToBadgeVariant(environment.tone)}>
              {environment.label}
            </Badge>
          </div>
        }
      />

      <Card variant="outlined" className="space-y-4 p-5 text-sm text-ck-text-secondary md:p-6">
        <p className="text-base font-medium text-ck-text-primary">
          {connected
            ? "Cuenta de Mercado Pago conectada"
            : "Todavía no conectaste una cuenta"}
        </p>
        <p className="rounded-md border border-ck-yellow/40 bg-ck-yellow/10 px-3 py-2 text-ck-text">
          Volvé a conectar o desconectá la cuenta receptora solo desde este panel. No uses
          «Mi cuenta de cobro» para la cuenta principal: esa ruta es para cuentas personales
          y puede generar conflictos.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          {operationalMessages.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
        <p className="text-xs text-ck-text-muted">
          {/* FINANCE_REVIEW */}
          Conectar una cuenta no redefine por sí sola la titularidad legal ni las
          obligaciones fiscales de los cobros. <span className="font-mono">FINANCE_REVIEW</span>
        </p>
      </Card>

      <Card variant="outlined" className="space-y-3 p-5 text-sm md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">Resumen operativo</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <dt className="text-ck-text-muted">Cuenta de Mercado Pago</dt>
            <dd>
              {connected
                ? `Conectada${panel?.accountMasked ? ` (${panel.accountMasked})` : ""}`
                : "No conectada"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-ck-text-muted">Estado de la conexión</dt>
            <dd>{connection.label}</dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-ck-text-muted">Entorno</dt>
            <dd>{environment.label}</dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-ck-text-muted">Aplicación de Mercado Pago</dt>
            <dd>
              {app.configured
                ? "Credenciales presentes"
                : "Faltan credenciales de la aplicación"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-ck-text-muted">Autorización manual</dt>
            <dd>{manual ? "Confirmada" : "Pendiente"}</dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-ck-text-muted">Preparación para pruebas internas</dt>
            <dd>{readiness.readyForDryRun ? "Lista" : "Incompleta"}</dd>
          </div>
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <dt className="text-ck-text-muted">Bloqueos</dt>
            <dd className="break-words">
              {readiness.blockers.length > 0
                ? readiness.blockers.join(" · ")
                : "Ninguno en esta verificación"}
            </dd>
          </div>
        </dl>
      </Card>

      {!connected ? (
        <Card
          variant="outlined"
          className="space-y-3 border-amber-500/40 bg-amber-500/5 p-5 text-sm md:p-6"
        >
          <h2 className="text-base font-semibold text-ck-text-primary">
            Si Mercado Pago dice que la aplicación no está preparada
          </h2>
          <p className="text-ck-text-secondary">
            Ese mensaje lo muestra Mercado Pago, no Clickatón. En la aplicación de
            desarrolladores, en URLs de redireccionamiento, cargá exactamente la URL
            indicada en información técnica (sin barra final y con https).
          </p>
          <ul className="list-disc space-y-2 pl-5 text-ck-text-secondary">
            <li>Guardá los cambios en Mercado Pago.</li>
            <li>Volvé a intentar «Conectar Mercado Pago».</li>
            <li>
              Si el problema continúa, revisá la información técnica o pedí soporte.
            </li>
          </ul>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-4 p-5 md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">
          {connected ? "Cuenta de Mercado Pago conectada" : "Conectar Mercado Pago"}
        </h2>
        <p className="text-sm text-ck-text-secondary">
          Conectá la cuenta de Mercado Pago que recibirá los pagos de las inscripciones
          cuando la distribución la utilice como cuenta receptora.
        </p>
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
            Solo un usuario con permiso de administración financiera de la suite puede
            conectar o desconectar esta cuenta.
          </p>
        ) : null}
      </Card>

      <AdminTechnicalInfo
        description="Datos para soporte y configuración avanzada. Cerrado por defecto. Sin secretos."
        rows={[
          {
            label: "Estado interno de conexión",
            value: panel?.status ?? "NOT_CONNECTED",
            mono: true,
          },
          {
            label: "Application ID configurado",
            value: app.clientIdPresent ? "Sí (valor solo en configuración del servidor)" : "No",
          },
          {
            label: "URL de retorno que enviamos",
            value: app.redirectUri || CLICKATON_MP_REDIRECTS.production,
            mono: true,
            copyText: app.redirectUri || CLICKATON_MP_REDIRECTS.production,
          },
          {
            label: "Protección de autorización (PKCE)",
            value: pkceOn ? "Activa" : "Desactivada",
          },
          {
            label: "Credenciales faltantes",
            value: app.missing.length ? app.missing.join(", ") : "Ninguna",
            mono: true,
          },
          {
            label: "Redirect staging",
            value: CLICKATON_MP_REDIRECTS.staging,
            mono: true,
          },
          {
            label: "Redirect producción",
            value: CLICKATON_MP_REDIRECTS.production,
            mono: true,
          },
          {
            label: "URL de notificaciones (staging)",
            value: CLICKATON_MP_NOTIFICATION_URLS.staging,
            mono: true,
          },
          {
            label: "URL de notificaciones (producción)",
            value: CLICKATON_MP_NOTIFICATION_URLS.production,
            mono: true,
          },
          {
            label: "Frase de autorización manual",
            value: OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
            mono: true,
          },
        ]}
      />
    </div>
  );
}
