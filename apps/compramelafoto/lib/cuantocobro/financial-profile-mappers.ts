import type { Prisma } from "@prisma/client";
import { normalizeCuantoCobroProfile } from "./personal-expenses";
import {
  ensureSchemaVersion,
  migrateStoredPayloadToCurrentVersion,
  stripSchemaVersionField,
} from "./schema-version";
import type { CuantoCobroProfileInput } from "./types";

export function profileInputToDbPayload(profile: CuantoCobroProfileInput): {
  schemaVersion: number;
  profileData: Prisma.InputJsonValue;
} {
  const normalized = normalizeCuantoCobroProfile(profile);
  const versioned = ensureSchemaVersion(normalized);
  const { schemaVersion, ...profileData } = versioned;

  return {
    schemaVersion,
    profileData: profileData as Prisma.InputJsonValue,
  };
}

export function dbRowToProfileInput(row: {
  schemaVersion: number;
  profileData: unknown;
}): CuantoCobroProfileInput {
  const migrated = migrateStoredPayloadToCurrentVersion({
    ...(row.profileData as Record<string, unknown>),
    schemaVersion: row.schemaVersion,
  });

  return normalizeCuantoCobroProfile(
    stripSchemaVersionField(migrated) as Partial<CuantoCobroProfileInput>,
  );
}
