import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PARTNER_ACCOUNT_UI_MESSAGES,
  isPartnerSelfConnectEnabled,
  readClickatonMpOAuthAppConfig,
  type PartnerPanelViewModel,
} from "@repo/payments";
import { canPerformFinanceAction } from "@repo/payments/finance-permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { PartnerMpConnectActions } from "@/components/admin/PartnerMpConnectActions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import {
  financeToneToBadgeVariant,
  presentMpConnectionStatus,
} from "@/lib/admin/edition-finance/ui/finance-status-presentation";
import { createPartnerOAuthRuntime } from "@/lib/admin/mp-partner-oauth/runtime";
import { adminRoutes } from "@/config/admin/navigation";

export const dynamic = "force-dynamic";

async function loadPartnerPanel(userId: number): Promise<PartnerPanelViewModel | null> {
  try {
    const actor = await loadFinanceActor(userId);
    const { service } = createPartnerOAuthRuntime();
    return await service.getPanelView(actor);
  } catch {
    return null;
  }
}

/**
 * Mi cuenta de cobro — partner self-connect (no owner actions).
 */
export default async function PartnerMpAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mp_oauth?: string; code?: string }>;
}) {
  const user = await requireClickatonAdmin({
    returnTo: "/admin/finanzas/mi-cuenta",
  });

  if (!isPartnerSelfConnectEnabled()) {
    notFound();
  }

  const params = await searchParams;
  const app = readClickatonMpOAuthAppConfig();
  const actor = await loadFinanceActor(user.id);
  const isFinanceOwner = canPerformFinanceAction(actor, "manage_suite_finance");
  const panel = await loadPartnerPanel(user.id);
  const connected = Boolean(
    panel &&
      (panel.status === "ACTIVE" ||
        panel.status === "VERIFIED" ||
        panel.status === "CONNECTED_UNVERIFIED"),
  );
  const connectEnabled = Boolean(
    app.configured && panel?.featureEnabled && panel.canConnect,
  );
  const connection = presentMpConnectionStatus(panel?.status ?? "NOT_CONNECTED");

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Mi cuenta de cobro"
        description="Conectá tu Mercado Pago personal para poder recibir fondos cuando una distribución te asigne como receptor. No modifica la cuenta principal ni los porcentajes."
        breadcrumbs={[
          { label: "Mi cuenta de cobro", href: adminRoutes.financePartner },
          { label: "Cuenta" },
        ]}
        actions={
          <Badge variant={financeToneToBadgeVariant(connection.tone)}>
            {connection.label}
          </Badge>
        }
      />

      {isFinanceOwner ? (
        <Card variant="outlined" className="space-y-3 p-5 text-sm text-ck-text-secondary md:p-6">
          <h2 className="text-base font-semibold text-ck-text-primary">
            Administración financiera
          </h2>
          <p>
            Como responsable financiero podés gestionar cuentas receptoras y porcentajes
            desde la edición. Esta pantalla es solo tu cuenta personal de cobro.
          </p>
          <div className="flex flex-col gap-3 pt-2 text-sm font-medium sm:flex-row sm:flex-wrap">
            <Link
              href="/admin/ediciones"
              className="min-h-11 text-ck-yellow underline-offset-4 hover:underline"
            >
              Ir a ediciones / finanzas
            </Link>
            <Link
              href={adminRoutes.financeOwner}
              className="min-h-11 text-ck-yellow underline-offset-4 hover:underline"
            >
              Cuenta que recibirá los pagos (principal)
            </Link>
          </div>
        </Card>
      ) : null}

      {params.mp_oauth === "connected" ? (
        <Card
          variant="outlined"
          className="border-emerald-500/40 p-4 text-sm text-emerald-300"
          role="status"
        >
          Conexión completada. {PARTNER_ACCOUNT_UI_MESSAGES.tokensNeverShown}
        </Card>
      ) : null}
      {params.mp_oauth === "error" ? (
        <Card
          variant="outlined"
          className="border-red-500/40 p-4 text-sm text-red-300"
          role="alert"
        >
          No pudimos completar la conexión con Mercado Pago. Intentá nuevamente.
          {params.code ? (
            <span className="mt-2 block text-xs text-ck-text-muted">
              Referencia: {params.code.slice(0, 64)}
            </span>
          ) : null}
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-4 p-5 text-sm text-ck-text-secondary md:p-6">
        <p className="text-ck-text-primary">{connection.description}</p>
        <ul className="list-disc space-y-2 pl-5">
          {(panel?.messages?.length
            ? panel.messages
            : [
                PARTNER_ACCOUNT_UI_MESSAGES.percentagesLocked,
                PARTNER_ACCOUNT_UI_MESSAGES.tokensNeverShown,
              ]
          ).map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
        <p className="text-xs text-ck-text-muted">
          {/* FINANCE_REVIEW */}
          Conectar tu cuenta no garantiza por sí sola el derecho a recibir fondos ni
          modifica acuerdos comerciales. <span className="font-mono">FINANCE_REVIEW</span>
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5 md:p-6">
        <h2 className="text-base font-semibold text-ck-text-primary">
          Mercado Pago personal
        </h2>
        <p className="text-sm text-ck-text-secondary">
          Conectá la cuenta de Mercado Pago que podrá recibir pagos cuando una distribución
          te incluya. Serás redirigido a Mercado Pago para autorizar la conexión. Clickatón
          no pide ni guarda tu contraseña de Mercado Pago.
        </p>
        {!app.configured ? (
          <p className="text-sm text-amber-300" role="status">
            La aplicación de Mercado Pago está incompleta en este entorno. El botón Conectar
            permanece deshabilitado hasta completar la configuración técnica.
          </p>
        ) : null}
        {panel ? (
          <PartnerMpConnectActions
            connected={connected}
            canConnect={panel.canConnect}
            canReconnect={panel.canReconnect}
            canRevoke={panel.canRevoke}
            connectEnabled={connectEnabled || (panel.canReconnect && app.configured)}
            accountMasked={panel.accountMasked}
            statusLabel={connection.label}
          />
        ) : (
          <p className="text-sm text-ck-text-muted">
            No tenés permiso para ver o conectar una cuenta de cobro propia. Pedí acceso al
            responsable financiero.
          </p>
        )}
      </Card>

      <AdminTechnicalInfo
        rows={[
          {
            label: "Estado interno de conexión",
            value: panel?.status ?? "NOT_CONNECTED",
            mono: true,
          },
          {
            label: "Cuenta enmascarada",
            value: panel?.accountMasked ?? "No informada",
            mono: true,
          },
          {
            label: "Aplicación Mercado Pago configurada",
            value: app.configured ? "sí" : "no",
          },
          {
            label: "Credenciales faltantes",
            value: app.missing.length ? app.missing.join(", ") : "Ninguna",
            mono: true,
          },
        ]}
      />
    </div>
  );
}
