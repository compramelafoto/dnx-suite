export type {
  CredentialVaultKeyConfig,
  EncryptedCredentialRecord,
  MercadoPagoCredentialPayload,
} from "./types.js";
export { CredentialVaultError } from "./types.js";
export { decodeMasterKey, decryptUtf8, encryptUtf8 } from "./aes-gcm.js";
export {
  loadCredentialVaultKeyConfig,
  UNIT_TEST_MASTER_KEY_BASE64,
} from "./keys.js";
export {
  CredentialVault,
  createMemoryCredentialStore,
  fingerprintAccessToken,
  sanitizeCredentialAuditMeta,
  sanitizeMpUserId,
  type CredentialRecordStore,
} from "./vault.js";
