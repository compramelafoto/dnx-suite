import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "./constants";

/**
 * Estado del consentimiento de split de una institución.
 *
 * MercadoPago exige que quien recibe su parte de un pago dividido **haya consentido**
 * explícitamente. Sin ese consentimiento activo, la orden con split se rechaza: no alcanza
 * con tener la cuenta vinculada.
 */
export type SplitConsentState = "NONE" | "PENDING" | "ACTIVE" | "REJECTED" | "CANCELED" | "EXPIRED";

/** Normaliza lo que devuelve MercadoPago, que mezcla mayúsculas y minúsculas. */
export function normalizeConsentStatus(raw: string | null | undefined): SplitConsentState {
  if (!raw) return "NONE";
  const upper = raw.trim().toUpperCase();
  switch (upper) {
    case "ACTIVE":
    case "PENDING":
    case "REJECTED":
    case "CANCELED":
    case "EXPIRED":
      return upper;
    default:
      // Un estado que no conocemos nunca se interpreta como activo.
      return "PENDING";
  }
}

/**
 * Ambiente del consentimiento.
 *
 * Ojo: `DnxSplitConsent` usa `PRODUCTION`/`SANDBOX` mientras que `DnxPaymentAccount` usa
 * `PROD`/`TEST`. Son enums distintos del esquema; se traduce acá en un solo lugar para que
 * la diferencia no se propague.
 */
const CONSENT_ENV = "PRODUCTION" as const;

/** Solo un consentimiento activo habilita el cobro con split. */
export function canChargeWithSplit(state: SplitConsentState): boolean {
  return state === "ACTIVE";
}

export type ConsentView = {
  state: SplitConsentState;
  /** Enlace de MercadoPago para que la institución otorgue el consentimiento, si aplica. */
  inviteUrl: string | null;
  lastCheckedAt: Date | null;
};

/**
 * Lee el consentimiento guardado para la cuenta de un workspace.
 *
 * **No consulta a MercadoPago**: devuelve lo último que registramos. La actualización
 * contra el proveedor es una operación aparte, porque implica una llamada de red y no
 * corresponde hacerla al pintar una pantalla.
 */
export async function getStoredSplitConsent(workspaceId: string): Promise<ConsentView> {
  const vacio: ConsentView = { state: "NONE", inviteUrl: null, lastCheckedAt: null };

  const identity = await prisma.dnxFinancialIdentity.findUnique({
    where: { organizationRef: workspaceOrganizationRef(workspaceId) },
    select: { id: true },
  });
  if (!identity) return vacio;

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: { financialIdentityId: identity.id, provider: "MERCADOPAGO", environment: "PROD" },
    select: { providerUserId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!account?.providerUserId) return vacio;

  const consent = await prisma.dnxSplitConsent.findFirst({
    where: {
      provider: "MERCADOPAGO",
      environment: CONSENT_ENV,
      providerReceiverId: account.providerUserId,
    },
    select: { status: true, invitationReference: true, lastCheckedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!consent) return vacio;

  return {
    state: normalizeConsentStatus(String(consent.status)),
    inviteUrl: consent.invitationReference,
    lastCheckedAt: consent.lastCheckedAt,
  };
}

/**
 * Guarda el consentimiento leído del proveedor.
 *
 * `source: "APPLICATION"` porque lo registró la aplicación al consultar, no una carga
 * manual ni una importación.
 */
export async function recordSplitConsent(input: {
  providerReceiverId: string;
  primaryProviderAccountReference: string;
  status: SplitConsentState;
  inviteUrl?: string | null;
  now?: Date;
}): Promise<void> {
  if (input.status === "NONE") return;
  const now = input.now ?? new Date();

  await prisma.dnxSplitConsent.upsert({
    where: {
      provider_environment_providerReceiverId: {
        provider: "MERCADOPAGO",
        environment: CONSENT_ENV,
        providerReceiverId: input.providerReceiverId,
      },
    },
    update: {
      status: input.status as never,
      invitationReference: input.inviteUrl ?? null,
      lastCheckedAt: now,
      providerUpdatedAt: now,
    },
    create: {
      provider: "MERCADOPAGO",
      environment: CONSENT_ENV,
      providerReceiverId: input.providerReceiverId,
      primaryProviderAccountReference: input.primaryProviderAccountReference,
      status: input.status as never,
      invitationReference: input.inviteUrl ?? null,
      source: "APPLICATION",
      lastCheckedAt: now,
      providerCreatedAt: now,
      providerUpdatedAt: now,
    },
  });
}
