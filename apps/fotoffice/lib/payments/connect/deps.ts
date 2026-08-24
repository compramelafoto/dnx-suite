import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
// Ruta estrecha: el barril raíz de @repo/payments no lo resuelve Turbopack.
import { createLiveMercadoPagoOAuthHttpClient } from "@repo/payments/mp-oauth/client";
import { readMpConnectConfig } from "./config";
import { decodeMasterKey, encryptUtf8 } from "./crypto";
import type { ConnectDeps, ConnectStateRecord } from "./service";

/** Clave maestra para cifrar el verificador PKCE. Misma bóveda que el resto de la plataforma. */
function readMasterKey(): string {
  const key = process.env.DNX_CREDENTIAL_VAULT_MASTER_KEY?.trim();
  if (!key) {
    throw new Error("DNX_CREDENTIAL_VAULT_MASTER_KEY no está configurada.");
  }
  return key;
}

/**
 * Adaptador de persistencia real.
 *
 * Cada consulta va por `organizationRef` del workspace: no se reusa el store de
 * `owner-oauth`, que responde "la única cuenta dueña de Clickatón" y filtra por el
 * marcador dedicado de ese producto.
 */
function createPrismaConnectStore(): ConnectDeps["store"] {
  return {
    async getOrCreateIdentity(organizationRef, legalName) {
      const existing = await prisma.dnxFinancialIdentity.findUnique({
        where: { organizationRef },
        select: { id: true },
      });
      if (existing) return { id: existing.id, organizationRef };

      const created = await prisma.dnxFinancialIdentity.create({
        data: {
          subjectType: "ORGANIZATION",
          organizationRef,
          legalName,
          countryCode: "AR",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      // `organizationRef` es el que acabamos de pasar: se devuelve tal cual para que el
      // puerto no tenga que lidiar con el null que permite el esquema.
      return { id: created.id, organizationRef };
    },

    async saveState(state) {
      await prisma.dnxMercadoPagoOAuthState.create({
        data: {
          stateHash: state.stateHash,
          userId: state.userId,
          financialIdentityId: state.financialIdentityId,
          productKey: state.productKey,
          purpose: "OWNER_CONNECTION",
          environment: state.environment,
          redirectUri: state.redirectUri,
          codeChallenge: state.codeChallenge,
          codeVerifierCiphertext: state.codeVerifierCiphertext,
          codeVerifierNonce: state.codeVerifierNonce,
          codeVerifierAuthTag: state.codeVerifierAuthTag,
          expiresAt: state.expiresAt,
        },
      });
      return state;
    },

    async findStateByHash(stateHash) {
      const row = await prisma.dnxMercadoPagoOAuthState.findUnique({
        where: { stateHash },
        select: {
          stateHash: true,
          userId: true,
          financialIdentityId: true,
          productKey: true,
          environment: true,
          redirectUri: true,
          codeChallenge: true,
          codeVerifierCiphertext: true,
          codeVerifierNonce: true,
          codeVerifierAuthTag: true,
          expiresAt: true,
          usedAt: true,
        },
      });
      if (!row) return null;

      // El workspace se recupera de la identidad, que es donde vive el organizationRef.
      const identity = await prisma.dnxFinancialIdentity.findUnique({
        where: { id: row.financialIdentityId },
        select: { organizationRef: true },
      });

      return {
        ...row,
        environment: row.environment as ConnectStateRecord["environment"],
        organizationRef: identity?.organizationRef ?? "",
      };
    },

    async markStateUsed(stateHash, at) {
      await prisma.dnxMercadoPagoOAuthState.update({
        where: { stateHash },
        data: { usedAt: at },
      });
    },

    /**
     * Guarda el token en `DnxEncryptedCredential`, cifrado con la clave maestra de la
     * bóveda — mismo formato y misma tabla que el resto de la plataforma.
     */
    async saveCredential(record) {
      const now = new Date();
      const payload = JSON.stringify({
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
        providerUserId: record.providerUserId,
        connectedAt: now.toISOString(),
        origin: "fotoffice_workspace_oauth",
        expiresAt: record.expiresIn
          ? new Date(now.getTime() + record.expiresIn * 1000).toISOString()
          : null,
      });
      const parts = encryptUtf8(payload, decodeMasterKey(readMasterKey()));

      const created = await prisma.dnxEncryptedCredential.create({
        data: {
          id: `dnxcred_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
          provider: "MERCADOPAGO",
          environment: record.environment,
          purpose: "mp_oauth_tokens",
          ciphertext: parts.ciphertext,
          nonce: parts.nonce,
          authTag: parts.authTag,
          keyVersion: process.env.DNX_CREDENTIAL_VAULT_KEY_VERSION?.trim() || "v1",
        },
        select: { id: true },
      });
      return { id: created.id };
    },

    async upsertPaymentAccount(account) {
      const existing = await prisma.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: account.financialIdentityId,
          provider: "MERCADOPAGO",
          environment: account.environment,
        },
        select: { id: true },
      });

      if (existing) {
        const updated = await prisma.dnxPaymentAccount.update({
          where: { id: existing.id },
          data: {
            providerUserId: account.providerUserId,
            credentialReference: account.credentialReference,
            originApp: account.originApp,
            capabilities: account.capabilities as never,
            status: account.status as never,
            connectedAt: account.connectedAt,
            tokenFingerprint: account.tokenFingerprint,
          },
          select: { id: true },
        });
        return updated;
      }

      return prisma.dnxPaymentAccount.create({
        data: {
          financialIdentityId: account.financialIdentityId,
          provider: "MERCADOPAGO",
          environment: account.environment,
          providerUserId: account.providerUserId,
          credentialReference: account.credentialReference,
          originApp: account.originApp,
          capabilities: account.capabilities as never,
          status: account.status as never,
          connectedAt: account.connectedAt,
          tokenFingerprint: account.tokenFingerprint,
          isPrimary: true,
        },
        select: { id: true },
      });
    },
  };
}

/** Dependencias reales del flujo de conexión. */
export function createConnectDeps(): ConnectDeps {
  return {
    config: readMpConnectConfig(),
    mpClient: createLiveMercadoPagoOAuthHttpClient(),
    masterKeyBase64: readMasterKey(),
    store: createPrismaConnectStore(),
  };
}
