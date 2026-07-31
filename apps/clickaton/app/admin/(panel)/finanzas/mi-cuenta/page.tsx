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
import { PartnerMpConnectActions } from "@/components/admin/PartnerMpConnectActions";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { loadFinanceActor } from "@/lib/admin/edition-finance/infrastructure/load-finance-actor";
import { createPartnerOAuthRuntime } from "@/lib/admin/mp-partner-oauth/runtime";
import { adminRoutes } from "@/config/admin/navigation";

export const dynamic = "force-dynamic";

function statusLabel(status: PartnerPanelViewModel["status"]): string {
  switch (status) {
    case "NOT_CONNECTED":
      return "No conectada";
    case "OAUTH_PENDING":
      return "Conectando";
    case "ACTIVE":
    case "VERIFIED":
      return "Activa";
    case "EXPIRED":
      return "Requiere reconexión";
    case "REVOKED":
      return "Revocada";
    case "ERROR":
      return "Error";
    default:
      return status;
  }
}

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

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Mi cuenta de cobro"
        description="Conectá tu Mercado Pago personal para recibir fondos. No modifica la cuenta owner ni los porcentajes."
        breadcrumbs={[
          { label: "Mi cuenta de cobro", href: adminRoutes.financePartner },
          { label: "Cuenta" },
        ]}
      />

      {isFinanceOwner ? (
        <Card variant="outlined" className="space-y-3 text-sm text-ck-text-secondary">
          <h2 className="text-base font-semibold text-ck-text-primary">
            Administración financiera
          </h2>
          <p>
            Como finance owner podés gestionar recipients, porcentajes y
            allocations desde la edición. Esta pantalla es solo tu cuenta de
            cobro personal (PARTNER_CONNECT).
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm font-medium">
            <Link
              href="/admin/ediciones"
              className="text-ck-yellow underline-offset-4 hover:underline"
            >
              Ir a ediciones / finanzas
            </Link>
            <Link
              href={adminRoutes.financeOwner}
              className="text-ck-yellow underline-offset-4 hover:underline"
            >
              Cuenta collector owner
            </Link>
          </div>
        </Card>
      ) : null}

      {params.mp_oauth === "connected" ? (
        <Card variant="outlined" className="border-emerald-500/40 text-sm text-emerald-300">
          Conexión completada. {PARTNER_ACCOUNT_UI_MESSAGES.tokensNeverShown}
        </Card>
      ) : null}
      {params.mp_oauth === "error" ? (
        <Card variant="outlined" className="border-red-500/40 text-sm text-red-300">
          No se pudo completar la conexión
          {params.code ? ` (${params.code.slice(0, 64)})` : ""}.
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-4 text-sm text-ck-text-secondary">
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
      </Card>

      <Card variant="outlined" className="space-y-4">
        <h2 className="text-base font-semibold text-ck-text-primary">
          Mercado Pago personal
        </h2>
        {!app.configured ? (
          <p className="text-sm text-amber-300">
            App Mercado Pago incompleta en este entorno (faltan Client ID/Secret).
            El botón Conectar permanece deshabilitado hasta configurar
            CLICKATON_MP_CLIENT_ID y CLICKATON_MP_CLIENT_SECRET.
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
            statusLabel={statusLabel(panel.status)}
          />
        ) : (
          <p className="text-sm text-ck-text-muted">
            No tenés permiso para ver o conectar una cuenta de cobro propia. Pedí
            el grant DNX_FINANCE_PARTNER_CONNECT.
          </p>
        )}
      </Card>
    </div>
  );
}
