import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "./constants";
import { canChargeWithSplit, getStoredSplitConsent, type SplitConsentState } from "./consent";

export type WorkspaceCollectionStatus =
  | "NOT_CONNECTED"
  | "PENDING"
  /** Cuenta vinculada, pero MercadoPago todavía no confirmó el consentimiento de split. */
  | "AWAITING_CONSENT"
  | "CONNECTED"
  | "NEEDS_REAUTH"
  | "REVOKED";

export type WorkspaceCollectionView = {
  status: WorkspaceCollectionStatus;
  /** Identificador enmascarado de la cuenta. Nunca el token ni el id completo. */
  accountLabel: string | null;
  connectedAt: Date | null;
  /** Única fuente para decidir si la institución puede cobrar. */
  canReceiveSplit: boolean;
  /** Estado del consentimiento de split ante MercadoPago. */
  consent: SplitConsentState;
  /** Enlace para otorgar el consentimiento, cuando MercadoPago lo provee. */
  consentInviteUrl: string | null;
};

/**
 * Traduce el estado técnico de la cuenta al estado que se le muestra a la institución.
 *
 * Una cuenta `ACTIVE` sin `SPLIT_RECEIVER` NO es "conectada": se vinculó, pero no puede
 * recibir su parte de un cobro. Mostrarla como conectada haría que la institución creyera
 * que ya puede cobrar cuotas cuando todavía no.
 *
 * Ante un estado desconocido se devuelve `PENDING`, nunca `CONNECTED`: si no entendemos
 * en qué situación está la cuenta, no podemos afirmar que se puede cobrar con ella.
 */
export function mapAccountToCollectionStatus(
  account: { status: string; capabilities: string[] } | null,
): WorkspaceCollectionStatus {
  if (!account) return "NOT_CONNECTED";
  switch (account.status) {
    case "ACTIVE":
      return account.capabilities.includes("SPLIT_RECEIVER") ? "CONNECTED" : "PENDING";
    case "PENDING":
      return "PENDING";
    case "NEEDS_REAUTH":
      return "NEEDS_REAUTH";
    case "REVOKED":
    case "DISABLED":
      return "REVOKED";
    default:
      return "PENDING";
  }
}

function maskProviderUser(providerUserId: string | null): string | null {
  if (!providerUserId) return null;
  const v = providerUserId.trim();
  if (!v) return null;
  if (v.length <= 4) return "****";
  return `****${v.slice(-4)}`;
}

/**
 * Estado de cobro de un workspace.
 *
 * Devuelve `NOT_CONNECTED` si todavía no hay identidad financiera: no crea nada. La
 * identidad se crea recién cuando la institución inicia la conexión a propósito — mismo
 * criterio que el guard que evita crear workspaces por visitar una ruta.
 */
export async function getWorkspaceCollectionStatus(
  workspaceId: string,
): Promise<WorkspaceCollectionView> {
  const notConnected: WorkspaceCollectionView = {
    status: "NOT_CONNECTED",
    accountLabel: null,
    connectedAt: null,
    canReceiveSplit: false,
    consent: "NONE",
    consentInviteUrl: null,
  };

  const identity = await prisma.dnxFinancialIdentity.findUnique({
    where: { organizationRef: workspaceOrganizationRef(workspaceId) },
    select: { id: true },
  });
  if (!identity) return notConnected;

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: {
      financialIdentityId: identity.id,
      provider: "MERCADOPAGO",
      environment: "PROD",
    },
    select: {
      status: true,
      capabilities: true,
      providerUserId: true,
      connectedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!account) return notConnected;

  const accountStatus = mapAccountToCollectionStatus({
    status: String(account.status),
    capabilities: (account.capabilities as unknown as string[]) ?? [],
  });

  const consent = await getStoredSplitConsent(workspaceId);
  const puedeCobrar = accountStatus === "CONNECTED" && canChargeWithSplit(consent.state);

  // Una cuenta técnicamente vinculada pero sin consentimiento activo NO puede cobrar:
  // MercadoPago rechaza la orden con split. Se muestra como pendiente de consentimiento,
  // nunca como conectada.
  const status: WorkspaceCollectionStatus =
    accountStatus === "CONNECTED" && !puedeCobrar ? "AWAITING_CONSENT" : accountStatus;

  return {
    status,
    accountLabel: maskProviderUser(account.providerUserId),
    connectedAt: account.connectedAt,
    canReceiveSplit: puedeCobrar,
    consent: consent.state,
    consentInviteUrl: consent.inviteUrl,
  };
}
