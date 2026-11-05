import { randomUUID } from "node:crypto";
import {
  CredentialVaultError,
  decodeMasterKey,
  decryptUtf8,
  encryptUtf8,
  loadCredentialVaultKeyConfig,
  type CredentialRecordStore,
} from "@repo/payments/credential-vault";
import {
  cleanCollectionSecret,
  type IntlCollectionSecret,
  type IntlPaymentsEnvironment,
} from "./collection-secret";

const PURPOSE = "clf_intl_collection";

export type CollectionVaultDeps = { store: CredentialRecordStore; env?: NodeJS.ProcessEnv };

/** Cifra el secreto de cobro y devuelve el id del registro guardado. */
export async function encryptCollectionSecret(
  secret: IntlCollectionSecret,
  environment: IntlPaymentsEnvironment,
  deps: CollectionVaultDeps,
): Promise<{ credentialId: string }> {
  const keyConfig = loadCredentialVaultKeyConfig(environment, deps.env ?? process.env);
  const key = decodeMasterKey(keyConfig.masterKeyBase64);
  const parts = encryptUtf8(JSON.stringify(secret), key);
  const id = `dnxcred_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await deps.store.save({
    id,
    provider: secret.provider === "PAYPAL_OWN" ? "PAYPAL" : "MERCADOPAGO",
    environment,
    purpose: PURPOSE,
    ciphertext: parts.ciphertext,
    nonce: parts.nonce,
    authTag: parts.authTag,
    keyVersion: keyConfig.keyVersion,
    createdAt: new Date(),
    rotatedAt: null,
    revokedAt: null,
  });
  return { credentialId: id };
}

export async function decryptCollectionSecret(
  credentialId: string,
  deps: CollectionVaultDeps,
): Promise<IntlCollectionSecret> {
  const record = await deps.store.get(credentialId);
  if (!record) throw new CredentialVaultError("CREDENTIAL_NOT_FOUND", "credential not found");
  if (record.revokedAt) throw new CredentialVaultError("CREDENTIAL_REVOKED", "credential revoked");
  const keyConfig = loadCredentialVaultKeyConfig(record.environment, deps.env ?? process.env);
  const plaintext = decryptUtf8(
    { ciphertext: record.ciphertext, nonce: record.nonce, authTag: record.authTag },
    decodeMasterKey(keyConfig.masterKeyBase64),
  );
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    parsed = null;
  }
  const secret = cleanCollectionSecret(parsed);
  if (!secret) throw new CredentialVaultError("INVALID_PAYLOAD", "decrypted payload invalid");
  return secret;
}

/** true si hay una clave de cifrado válida para el entorno. */
export function isCollectionVaultConfigured(
  environment: IntlPaymentsEnvironment,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    decodeMasterKey(loadCredentialVaultKeyConfig(environment, env).masterKeyBase64);
    return true;
  } catch (error) {
    if (error instanceof CredentialVaultError) return false;
    throw error;
  }
}

/** Dependencias reales (base de datos). Import dinámico para no exigir base en los tests. */
export async function defaultCollectionVaultDeps(): Promise<CollectionVaultDeps> {
  const [{ prisma }, { createPrismaCredentialStore }] = await Promise.all([
    import("@/lib/prisma"),
    import("@repo/payments/infrastructure/prisma/credential-store"),
  ]);
  return { store: createPrismaCredentialStore(prisma as never) };
}
