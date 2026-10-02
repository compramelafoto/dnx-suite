import { randomUUID } from "node:crypto";

import {
  normalizeAffiliateConsentStatus,
  type AffiliateConsentStatus,
} from "../domain/labels";

/**
 * Vinculación del fotógrafo afiliado con Mercado Pago (permiso de Split 1:N).
 *
 * MP sólo reparte un cobro a quien aceptó recibir dinero en operaciones que cobra
 * otro. La invitación la manda la cuenta cobradora (DNX) y el fotógrafo acepta
 * **en MP**; acá guardamos el receptor y el estado, y lo volvemos a consultar.
 *
 * Ojo: el `receiver_id` que devuelve MP es un UUID. Se consulta SIEMPRE por ese
 * UUID; FOTOFFICE consultaba con el id numérico de la cuenta y nunca encontraba
 * el permiso.
 */

/** Cuenta cobradora DNX (`DnxPaymentAccount`) con cuyo token se invita. */
export const DNX_COLLECTOR_PAYMENT_ACCOUNT_ID = "pa_ba733fa7a35f4326";
/** Usuario de MP de la cuenta cobradora: la cuenta "dueña" del permiso. */
export const DNX_COLLECTOR_PROVIDER_USER_ID = "97484805";

/** Puerto del proveedor, para poder probar sin llamar a Mercado Pago. */
export type AffiliateConsentProviderPort = {
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

export type AffiliateConsentRecord = {
  id: string;
  userId: number | null;
  displayName: string;
  mpSellerEmail: string;
  paymentRecipientId: string | null;
  consentReceiverId: string | null;
  consentStatus: string;
  consentInviteUrl: string | null;
  isActive: boolean;
};

export type SplitConsentRow = {
  providerReceiverId: string;
  recipientId: string;
  status: Exclude<AffiliateConsentStatus, "NONE">;
  invitationReference: string | null;
  primaryProviderAccountReference: string;
  checkedAt: Date;
};

/** Persistencia que necesita la vinculación (Prisma en producción, memoria en tests). */
export type AffiliateConsentRepository = {
  findAffiliate(affiliateId: string): Promise<AffiliateConsentRecord | null>;
  /** Devuelve el `DnxPaymentRecipient` (tipo AFFILIATE) del afiliado; lo crea si falta. */
  ensurePaymentRecipient(affiliate: AffiliateConsentRecord): Promise<string>;
  updateAffiliateConsent(
    affiliateId: string,
    data: {
      paymentRecipientId: string;
      consentReceiverId: string;
      consentStatus: AffiliateConsentStatus;
      consentInviteUrl: string | null;
      consentCheckedAt: Date;
    },
  ): Promise<void>;
  /** Upsert de `DnxSplitConsent` (MERCADOPAGO, PRODUCTION, receptor UUID). */
  upsertSplitConsent(row: SplitConsentRow): Promise<void>;
  findSplitConsent(providerReceiverId: string): Promise<{ status: string } | null>;
};

export type AffiliateConsentDeps = {
  provider: AffiliateConsentProviderPort;
  repo: AffiliateConsentRepository;
  environment?: "sandbox" | "production";
  now?: () => Date;
  newIdempotencyKey?: () => string;
};

export type AffiliateConsentResult =
  | { ok: true; state: AffiliateConsentStatus; inviteUrl: string | null }
  | { ok: false; error: string };

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Nunca un token en los logs.
  return message.replace(/(APP_USR|TEST)-[\w-]+/g, "[token]").slice(0, 200);
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function persistConsent(
  affiliate: AffiliateConsentRecord,
  input: { receiverId: string; state: AffiliateConsentStatus; inviteUrl: string | null },
  deps: AffiliateConsentDeps,
): Promise<void> {
  const now = (deps.now ?? (() => new Date()))();
  const recipientId = await deps.repo.ensurePaymentRecipient(affiliate);
  await deps.repo.updateAffiliateConsent(affiliate.id, {
    paymentRecipientId: recipientId,
    consentReceiverId: input.receiverId,
    consentStatus: input.state,
    consentInviteUrl: input.inviteUrl,
    consentCheckedAt: now,
  });
  if (input.state !== "NONE") {
    await deps.repo.upsertSplitConsent({
      providerReceiverId: input.receiverId,
      recipientId,
      status: input.state,
      invitationReference: input.inviteUrl,
      primaryProviderAccountReference: DNX_COLLECTOR_PROVIDER_USER_ID,
      checkedAt: now,
    });
  }
}

/**
 * Le pide a MP que invite al fotógrafo (por el email de su cuenta de MP) y guarda
 * el receptor UUID, el estado y el link de la invitación.
 */
export async function inviteAffiliate(
  affiliateId: string,
  deps: AffiliateConsentDeps,
): Promise<AffiliateConsentResult> {
  const affiliate = await deps.repo.findAffiliate(affiliateId);
  if (!affiliate) return { ok: false, error: "No encontramos al fotógrafo." };
  if (!affiliate.isActive) {
    return { ok: false, error: "El fotógrafo está desactivado." };
  }
  if (normalizeAffiliateConsentStatus(affiliate.consentStatus) === "ACTIVE") {
    return { ok: true, state: "ACTIVE", inviteUrl: affiliate.consentInviteUrl };
  }
  const email = affiliate.mpSellerEmail.trim().toLowerCase();
  if (!emailValido(email)) {
    return { ok: false, error: "El email de Mercado Pago del fotógrafo no parece válido." };
  }

  let resultados: Awaited<ReturnType<AffiliateConsentProviderPort["invite"]>>;
  try {
    resultados = await deps.provider.invite({
      environment: deps.environment ?? "production",
      sellerEmails: [email],
      idempotencyKey: (deps.newIdempotencyKey ?? randomUUID)(),
    });
  } catch (error) {
    const detalle = sanitizeError(error);
    console.error("[clickaton][afiliados] invitación rechazada", { affiliateId, detalle });
    if (detalle.includes("PRODUCTION_FLAG_OFF")) {
      return {
        ok: false,
        error: "Las invitaciones de Mercado Pago están apagadas (DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED).",
      };
    }
    return { ok: false, error: "Mercado Pago no aceptó la invitación. Probá de nuevo." };
  }

  const primero = resultados[0];
  if (!primero?.receiverId) {
    return {
      ok: false,
      error: "Mercado Pago no pudo invitar a ese email. Revisá que sea el de su cuenta.",
    };
  }

  const state = normalizeAffiliateConsentStatus(primero.status);
  const inviteUrl = primero.inviteUrl ?? null;
  await persistConsent(affiliate, { receiverId: primero.receiverId, state, inviteUrl }, deps);
  return { ok: true, state, inviteUrl };
}

/**
 * Vuelve a preguntarle a MP en qué quedó el permiso. Hace falta porque el
 * fotógrafo acepta fuera de Clickatón: sin consultar, quedaría "pendiente".
 */
export async function refreshAffiliateConsent(
  affiliateId: string,
  deps: AffiliateConsentDeps,
): Promise<AffiliateConsentResult> {
  const affiliate = await deps.repo.findAffiliate(affiliateId);
  if (!affiliate) return { ok: false, error: "No encontramos al fotógrafo." };
  const receiverId = affiliate.consentReceiverId?.trim();
  if (!receiverId) {
    return { ok: false, error: "Primero hay que enviarle la invitación." };
  }

  let consent: Awaited<ReturnType<AffiliateConsentProviderPort["getConsent"]>>;
  try {
    // Por UUID: es lo único que MP reconoce como receptor.
    consent = await deps.provider.getConsent(receiverId);
  } catch (error) {
    console.error("[clickaton][afiliados] consulta rechazada", {
      affiliateId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos consultar a Mercado Pago. Probá de nuevo." };
  }
  if (!consent) {
    return {
      ok: false,
      error: "Mercado Pago no encuentra la invitación. Probá enviarla de nuevo.",
    };
  }

  const state = normalizeAffiliateConsentStatus(consent.status);
  const inviteUrl = consent.inviteUrl ?? affiliate.consentInviteUrl ?? null;
  await persistConsent(affiliate, { receiverId, state, inviteUrl }, deps);
  return { ok: true, state, inviteUrl };
}

/**
 * Receptor para repartir el cobro, sólo si el permiso está ACTIVO (en la ficha
 * del afiliado y en `DnxSplitConsent`). Ante cualquier duda devuelve null y la
 * comisión se paga a mano: nunca se arma un reparto que MP va a rechazar.
 */
export async function getActiveSplitReceiver(
  affiliateId: string,
  deps: { repo: AffiliateConsentRepository },
): Promise<{ receiverId: string; recipientId: string } | null> {
  try {
    const affiliate = await deps.repo.findAffiliate(affiliateId);
    if (!affiliate?.isActive) return null;
    if (normalizeAffiliateConsentStatus(affiliate.consentStatus) !== "ACTIVE") return null;
    const receiverId = affiliate.consentReceiverId?.trim();
    const recipientId = affiliate.paymentRecipientId?.trim();
    if (!receiverId || !recipientId) return null;

    const consent = await deps.repo.findSplitConsent(receiverId);
    if (normalizeAffiliateConsentStatus(consent?.status) !== "ACTIVE") return null;
    return { receiverId, recipientId };
  } catch (error) {
    console.error("[clickaton][afiliados] no se pudo leer el permiso", {
      affiliateId,
      detalle: sanitizeError(error),
    });
    return null;
  }
}
