import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "./constants";
import { canChargeWithSplit, getStoredSplitConsent, type SplitConsentState } from "./consent";
import { readCollectionMode, requiresSplitConsent, type CollectionMode } from "./mode";

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
  canCharge: boolean;
  /** Cómo se cobra. Decide qué se le exige a la cuenta y qué se le muestra a la institución. */
  mode: CollectionMode;
  /** Estado del consentimiento de split. Siempre `NONE` en dos vías: ahí no existe. */
  consent: SplitConsentState;
  /** Enlace para otorgar el consentimiento, cuando MercadoPago lo provee. */
  consentInviteUrl: string | null;
};

/**
 * Traduce el estado técnico de la cuenta al estado que se le muestra a la institución.
 *
 * Qué se le exige depende del modo de cobro:
 *
 * - En **1:N** una cuenta `ACTIVE` sin `SPLIT_RECEIVER` NO es "conectada": se vinculó, pero
 *   no puede recibir su parte. Mostrarla como conectada haría creer que ya se puede cobrar.
 * - En **dos vías** esa capacidad no interviene, porque no hay reparto: la institución cobra
 *   con sus propias credenciales. Exigirla dejaría a una cuenta perfectamente vinculada en
 *   "pendiente" para siempre.
 *
 * Ante un estado desconocido se devuelve `PENDING`, nunca `CONNECTED`: si no entendemos
 * en qué situación está la cuenta, no podemos afirmar que se puede cobrar con ella.
 */
export function mapAccountToCollectionStatus(
  account: { status: string; capabilities: string[] } | null,
  mode: CollectionMode = "TWO_WAY",
): WorkspaceCollectionStatus {
  if (!account) return "NOT_CONNECTED";
  switch (account.status) {
    case "ACTIVE":
      if (mode === "TWO_WAY") return "CONNECTED";
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
  const mode = readCollectionMode();
  const notConnected: WorkspaceCollectionView = {
    status: "NOT_CONNECTED",
    accountLabel: null,
    connectedAt: null,
    canCharge: false,
    mode,
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

  const accountStatus = mapAccountToCollectionStatus(
    {
      status: String(account.status),
      capabilities: (account.capabilities as unknown as string[]) ?? [],
    },
    mode,
  );

  const base = {
    accountLabel: maskProviderUser(account.providerUserId),
    connectedAt: account.connectedAt,
    mode,
  };

  if (!requiresSplitConsent(mode)) {
    // Dos vías: no se consulta el consentimiento porque no interviene. Preguntarlo daría un
    // "NONE" que la pantalla podría malinterpretar como algo que falta hacer.
    return {
      ...base,
      status: accountStatus,
      canCharge: accountStatus === "CONNECTED",
      consent: "NONE",
      consentInviteUrl: null,
    };
  }

  const consent = await getStoredSplitConsent(workspaceId);
  const puedeCobrar = accountStatus === "CONNECTED" && canChargeWithSplit(consent.state);

  // Una cuenta técnicamente vinculada pero sin consentimiento activo NO puede cobrar:
  // MercadoPago rechaza la orden con split. Se muestra como pendiente de consentimiento,
  // nunca como conectada.
  const status: WorkspaceCollectionStatus =
    accountStatus === "CONNECTED" && !puedeCobrar ? "AWAITING_CONSENT" : accountStatus;

  return {
    ...base,
    status,
    canCharge: puedeCobrar,
    consent: consent.state,
    consentInviteUrl: consent.inviteUrl,
  };
}
