import type {
  CredentialRecordStore,
  EncryptedCredentialRecord,
} from "../../credential-vault/index.js";
import type { FinancialEnvironment, FinancialProvider } from "../../financial-identity/types.js";

/** Narrow Prisma surface for encrypted credentials. */
export interface EncryptedCredentialPrismaDelegate {
  dnxEncryptedCredential: {
    create: (args: {
      data: {
        id: string;
        provider: string;
        environment: string;
        purpose: string;
        ciphertext: string;
        nonce: string;
        authTag: string;
        keyVersion: string;
        createdAt: Date;
        rotatedAt: Date | null;
        revokedAt: Date | null;
      };
    }) => Promise<Record<string, unknown>>;
    findUnique: (args: {
      where: { id: string };
    }) => Promise<Record<string, unknown> | null>;
    update: (args: {
      where: { id: string };
      data: { revokedAt: Date };
    }) => Promise<unknown>;
  };
}

function mapRow(row: Record<string, unknown>): EncryptedCredentialRecord {
  return {
    id: String(row.id),
    provider: row.provider as FinancialProvider,
    environment: row.environment as FinancialEnvironment,
    purpose: String(row.purpose),
    ciphertext: String(row.ciphertext),
    nonce: String(row.nonce),
    authTag: String(row.authTag),
    keyVersion: String(row.keyVersion),
    createdAt: new Date(String(row.createdAt)),
    rotatedAt: row.rotatedAt ? new Date(String(row.rotatedAt)) : null,
    revokedAt: row.revokedAt ? new Date(String(row.revokedAt)) : null,
  };
}

export function createPrismaCredentialStore(
  prisma: EncryptedCredentialPrismaDelegate,
): CredentialRecordStore {
  return {
    async save(record) {
      const created = await prisma.dnxEncryptedCredential.create({
        data: {
          id: record.id,
          provider: record.provider,
          environment: record.environment,
          purpose: record.purpose,
          ciphertext: record.ciphertext,
          nonce: record.nonce,
          authTag: record.authTag,
          keyVersion: record.keyVersion,
          createdAt: record.createdAt,
          rotatedAt: record.rotatedAt,
          revokedAt: record.revokedAt,
        },
      });
      return mapRow(created);
    },
    async get(id) {
      const row = await prisma.dnxEncryptedCredential.findUnique({
        where: { id },
      });
      return row ? mapRow(row) : null;
    },
    async markRevoked(id, at = new Date()) {
      await prisma.dnxEncryptedCredential.update({
        where: { id },
        data: { revokedAt: at },
      });
    },
  };
}
