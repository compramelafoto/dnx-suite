import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "./constants";
import { normalizeConsentStatus, recordSplitConsent, type SplitConsentState } from "./consent";
import { sanitizeError } from "./log";

/** Access token de la aplicación de FotoOffice. La invitación la envía la plataforma. */
export const PLATFORM_TOKEN_ENV = "FOTOFFICE_MP_ACCESS_TOKEN" as const;

export type ConsentInviteResult =
  | { ok: true; state: SplitConsentState; inviteUrl: string | null }
  | { ok: false; error: string };

/** Puerto del proveedor, para poder probar sin llamar a MercadoPago. */
export type ConsentProviderPort = {
  invite(input: {
    environment: "sandbox" | "production";
    sellerEmails: string[];
    idempotencyKey: string;
  }): Promise<
    Array<{ sellerEmail: string; receiverId: string; status: string; inviteUrl?: string }>
  >;
  getConsent(
    receiverId: string,
  ): Promise<{ receiverId: string; status: string; inviteUrl?: string } | null>;
};

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Pide a MercadoPago la autorización de cobro dividido para la cuenta de una institución.
 *
 * El email lo declara la institución en la pantalla: el que devuelve la API de OAuth viene
 * enmascarado a propósito, así que no se puede deducir. Pedirlo explícitamente además
 * cubre el caso de que la cuenta de MercadoPago use un correo distinto al del workspace.
 *
 * MercadoPago responde con un enlace, y la autorización se otorga **allá**: es el receptor
 * quien acepta recibir dinero en operaciones cobradas por otro. Un tilde en nuestra
 * pantalla no produciría ese consentimiento — MercadoPago rechazaría el cobro igual.
 */
export async function requestSplitConsent(
  input: { workspaceId: string; sellerEmail: string },
  deps: { provider: ConsentProviderPort; environment?: "sandbox" | "production" },
): Promise<ConsentInviteResult> {
  const email = input.sellerEmail.trim().toLowerCase();
  if (!emailValido(email)) {
    return { ok: false, error: "El email no parece válido." };
  }

  const identity = await prisma.dnxFinancialIdentity.findUnique({
    where: { organizationRef: workspaceOrganizationRef(input.workspaceId) },
    select: { id: true },
  });
  if (!identity) {
    return { ok: false, error: "Primero conectá tu cuenta de MercadoPago." };
  }

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: { financialIdentityId: identity.id, provider: "MERCADOPAGO", environment: "PROD" },
    select: { providerUserId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!account?.providerUserId) {
    return { ok: false, error: "Primero conectá tu cuenta de MercadoPago." };
  }

  let resultados: Awaited<ReturnType<ConsentProviderPort["invite"]>>;
  try {
    resultados = await deps.provider.invite({
      environment: deps.environment ?? "production",
      sellerEmails: [email],
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    // Se registra ACÁ, donde ocurre: el catch de la acción no ve este error porque no
    // escapa de esta función. Sin esto, un rechazo del proveedor es indistinguible de un
    // bug propio y no queda rastro de por qué falló.
    console.error("[fotoffice][split-consent] invite rechazado", {
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "MercadoPago no aceptó la solicitud. Probá de nuevo." };
  }

  const primero = resultados[0];
  if (!primero) {
    return {
      ok: false,
      error: "MercadoPago no pudo enviar la solicitud a ese email. Revisá que sea el correcto.",
    };
  }

  const state = normalizeConsentStatus(primero.status);
  await recordSplitConsent({
    // El receptor que informa MercadoPago manda por sobre el de la cuenta: es el que va a
    // usar al validar la orden.
    providerReceiverId: primero.receiverId || account.providerUserId,
    primaryProviderAccountReference: account.providerUserId,
    status: state,
    inviteUrl: primero.inviteUrl ?? null,
  });

  return { ok: true, state, inviteUrl: primero.inviteUrl ?? null };
}

/**
 * Vuelve a preguntarle a MercadoPago en qué estado quedó el consentimiento.
 *
 * Hace falta porque el receptor acepta fuera de nuestra aplicación: sin volver a
 * consultar, la pantalla se quedaría diciendo "pendiente" para siempre.
 */
export async function refreshSplitConsent(
  workspaceId: string,
  deps: { provider: ConsentProviderPort },
): Promise<{ ok: true; state: SplitConsentState } | { ok: false; error: string }> {
  const identity = await prisma.dnxFinancialIdentity.findUnique({
    where: { organizationRef: workspaceOrganizationRef(workspaceId) },
    select: { id: true },
  });
  if (!identity) return { ok: false, error: "Todavía no hay una cuenta conectada." };

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: { financialIdentityId: identity.id, provider: "MERCADOPAGO", environment: "PROD" },
    select: { providerUserId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!account?.providerUserId) {
    return { ok: false, error: "Todavía no hay una cuenta conectada." };
  }

  let consent: Awaited<ReturnType<ConsentProviderPort["getConsent"]>>;
  try {
    consent = await deps.provider.getConsent(account.providerUserId);
  } catch (error) {
    console.error("[fotoffice][split-consent] consulta rechazada", {
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos consultar a MercadoPago. Probá de nuevo." };
  }

  const state = normalizeConsentStatus(consent?.status);
  if (state !== "NONE") {
    await recordSplitConsent({
      providerReceiverId: account.providerUserId,
      primaryProviderAccountReference: account.providerUserId,
      status: state,
      inviteUrl: consent?.inviteUrl ?? null,
    });
  }
  return { ok: true, state };
}
