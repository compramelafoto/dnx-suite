import { prisma } from "@/lib/prisma";

const LEASE_ROW_ID = 1;
const DEFAULT_LEASE_MS = 8 * 60 * 1000;

export type ExifDeviceScanLeaseSnapshot = {
  isLocked: boolean;
  holder: string | null;
  lockedAt: string | null;
  expiresAt: string | null;
  isStale: boolean;
};

export async function getExifDeviceScanLease(): Promise<ExifDeviceScanLeaseSnapshot> {
  const now = new Date();
  const row = await prisma.exifDeviceScanLease.findUnique({ where: { id: LEASE_ROW_ID } });
  if (!row?.expiresAt || !row.holder) {
    return {
      isLocked: false,
      holder: null,
      lockedAt: null,
      expiresAt: null,
      isStale: false,
    };
  }

  const isStale = row.expiresAt.getTime() <= now.getTime();
  return {
    isLocked: !isStale,
    holder: row.holder,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    isStale,
  };
}

export async function tryAcquireExifDeviceScanLease(
  holder: string,
  leaseMs = DEFAULT_LEASE_MS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);

  const updated = await prisma.$executeRaw`
    UPDATE "ExifDeviceScanLease"
    SET "holder" = ${holder},
        "lockedAt" = ${now},
        "expiresAt" = ${expiresAt},
        "updatedAt" = ${now}
    WHERE "id" = ${LEASE_ROW_ID}
      AND ("expiresAt" IS NULL OR "expiresAt" < ${now})
  `;

  return Number(updated) === 1;
}

export async function releaseExifDeviceScanLease(holder: string): Promise<void> {
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE "ExifDeviceScanLease"
    SET "holder" = NULL,
        "lockedAt" = NULL,
        "expiresAt" = NULL,
        "updatedAt" = ${now}
    WHERE "id" = ${LEASE_ROW_ID}
      AND "holder" = ${holder}
  `;
}

export async function forceReleaseExifDeviceScanLease(): Promise<ExifDeviceScanLeaseSnapshot> {
  const now = new Date();
  await prisma.exifDeviceScanLease.update({
    where: { id: LEASE_ROW_ID },
    data: {
      holder: null,
      lockedAt: null,
      expiresAt: null,
    },
  });
  return getExifDeviceScanLease();
}
