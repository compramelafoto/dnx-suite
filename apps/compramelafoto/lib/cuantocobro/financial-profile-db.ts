import { prisma } from "@/lib/prisma";
import {
  dbRowToProfileInput,
  profileInputToDbPayload,
} from "@/lib/cuantocobro/financial-profile-mappers";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

export { dbRowToProfileInput, profileInputToDbPayload } from "@/lib/cuantocobro/financial-profile-mappers";

export async function getFinancialProfileByUserId(
  userId: number,
): Promise<CuantoCobroProfileInput | null> {
  const row = await prisma.cuantoCobroFinancialProfile.findUnique({
    where: { userId },
    select: { schemaVersion: true, profileData: true },
  });

  if (!row) return null;

  return dbRowToProfileInput(row);
}

export async function upsertFinancialProfile(
  userId: number,
  profile: CuantoCobroProfileInput,
): Promise<CuantoCobroProfileInput> {
  const payload = profileInputToDbPayload(profile);

  const row = await prisma.cuantoCobroFinancialProfile.upsert({
    where: { userId },
    create: {
      userId,
      schemaVersion: payload.schemaVersion,
      profileData: payload.profileData,
    },
    update: {
      schemaVersion: payload.schemaVersion,
      profileData: payload.profileData,
    },
    select: { schemaVersion: true, profileData: true },
  });

  return dbRowToProfileInput(row);
}
