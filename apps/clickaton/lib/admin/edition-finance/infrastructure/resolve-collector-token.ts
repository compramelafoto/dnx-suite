import { prisma } from "@/lib/admin/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";

/**
 * Resuelve access token OAuth del DnxPaymentAccount del beneficiario.
 * Nunca loguear el token. Fallar cerrado si cuenta inválida.
 */
export async function resolveCollectorAccessTokenFromPaymentAccount(
  paymentAccountId: string,
): Promise<
  | { ok: true; accessToken: string; environment: string; providerUserId: string | null }
  | { ok: false; code: string; message: string }
> {
  const account = await prisma.dnxPaymentAccount.findUnique({
    where: { id: paymentAccountId },
    select: {
      id: true,
      status: true,
      provider: true,
      environment: true,
      providerUserId: true,
      credentialReference: true,
      financialIdentity: { select: { ownerUserId: true, status: true } },
    },
  });

  if (!account) {
    return { ok: false, code: "ACCOUNT_NOT_FOUND", message: "Payment account inexistente." };
  }
  if (account.status !== "ACTIVE") {
    return {
      ok: false,
      code: "ACCOUNT_NOT_ACTIVE",
      message: `Payment account status=${account.status}`,
    };
  }
  if (account.provider !== "MERCADOPAGO") {
    return {
      ok: false,
      code: "PROVIDER_UNSUPPORTED",
      message: "Solo Mercado Pago en esta etapa.",
    };
  }
  if (!account.credentialReference) {
    return {
      ok: false,
      code: "CREDENTIAL_MISSING",
      message: "La cuenta no tiene credentialReference (OAuth incompleto).",
    };
  }
  if (account.financialIdentity.status !== "ACTIVE") {
    return {
      ok: false,
      code: "IDENTITY_INACTIVE",
      message: "Identidad financiera inactiva.",
    };
  }

  try {
    const store = createPrismaCredentialStore(prisma as never);
    const vault = new CredentialVault(store);
    const payload = await vault.decryptMercadoPagoCredential(account.credentialReference);
    if (!payload.accessToken?.trim()) {
      return { ok: false, code: "TOKEN_EMPTY", message: "Credential sin access token." };
    }
    return {
      ok: true,
      accessToken: payload.accessToken,
      environment: account.environment,
      providerUserId: account.providerUserId,
    };
  } catch (err) {
    return {
      ok: false,
      code: "VAULT_DECRYPT_FAILED",
      message: err instanceof Error ? err.message.slice(0, 120) : "vault_error",
    };
  }
}
