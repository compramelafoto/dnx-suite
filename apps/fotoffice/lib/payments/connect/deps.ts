import { prisma } from "@repo/db";
import {
  CredentialVault,
  createLiveMercadoPagoOAuthHttpClient,
  createPrismaCredentialStore,
} from "@repo/payments";
import { readMpConnectConfig } from "./config";
import type { ConnectDeps, ConnectStateRecord } from "./service";

/**
 * Clave maestra para cifrar el verificador PKCE.
 *
 * Es **la misma variable que usa la bóveda de credenciales** de `@repo/payments`
 * (`loadCredentialVaultKeyConfig`), a propósito: dos claves distintas para el mismo flujo
 * serían dos cosas que rotar y dos formas de perder acceso a lo cifrado.
 */
function readMasterKey(): string {
  const key = process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim();
  if (!key) {
    throw new Error("DNX_FINANCIAL_CREDENTIAL_MASTER_KEY no está configurada.");
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
     * Guarda el token en la bóveda de credenciales de la plataforma: cifrado, en
     * `DnxEncryptedCredential`, con el mismo formato que el resto del monorepo.
     */
    async saveCredential(record) {
      const vault = new CredentialVault(createPrismaCredentialStore(prisma as never));
      const now = new Date();
      const saved = await vault.encryptMercadoPagoCredential({
        environment: record.environment,
        payload: {
          accessToken: record.accessToken,
          refreshToken: record.refreshToken,
          providerUserId: record.providerUserId,
          connectedAt: now.toISOString(),
          origin: "fotoffice_workspace_oauth",
          expiresAt: record.expiresIn
            ? new Date(now.getTime() + record.expiresIn * 1000).toISOString()
            : null,
        },
      });
      return { id: saved.id };
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
