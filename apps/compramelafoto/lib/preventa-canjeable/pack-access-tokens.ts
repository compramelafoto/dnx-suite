import { createHash, randomBytes } from "crypto";
import { OrderOrigin, OrderStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

const DEFAULT_TOKEN_TTL_DAYS = 60;
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function resolveTtlDays(): number {
  const raw = process.env.PACK_ACCESS_TOKEN_TTL_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_TOKEN_TTL_DAYS;
}

export function generatePackAccessToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export async function createPackAccessTokenForOrder(
  orderId: number,
  opts?: { ttlDays?: number; revokeExisting?: boolean }
): Promise<{ token: string; expiresAt: Date } | null> {
  if (!Number.isFinite(orderId) || orderId <= 0) return null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, origin: true, status: true },
  });
  if (!order || order.origin !== OrderOrigin.PREVENTA_PACK || order.status !== OrderStatus.PAID) {
    return null;
  }

  const now = new Date();
  const { token, tokenHash } = generatePackAccessToken();
  const expiresAt = addDays(now, opts?.ttlDays ?? resolveTtlDays());
  await prisma.$transaction(async (tx) => {
    if (opts?.revokeExisting ?? true) {
      await tx.packAccessToken.updateMany({
        where: {
          orderId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { revokedAt: now },
      });
    }
    await tx.packAccessToken.create({
      data: {
        orderId,
        tokenHash,
        expiresAt,
      },
    });
  });

  return { token, expiresAt };
}

export async function ensurePackAccessTokenForOrder(
  orderId: number,
  opts?: { ttlDays?: number }
): Promise<{ token: string; expiresAt: Date } | null> {
  if (!Number.isFinite(orderId) || orderId <= 0) return null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, origin: true, status: true },
  });
  if (!order || order.origin !== OrderOrigin.PREVENTA_PACK || order.status !== OrderStatus.PAID) {
    return null;
  }
  const now = new Date();
  const existing = await prisma.packAccessToken.findFirst({
    where: {
      orderId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  if (existing) return null;

  const { token, tokenHash } = generatePackAccessToken();
  const expiresAt = addDays(now, opts?.ttlDays ?? resolveTtlDays());
  await prisma.packAccessToken.create({
    data: {
      orderId,
      tokenHash,
      expiresAt,
    },
  });
  return { token, expiresAt };
}


type PackTokenLookupResult =
  | { ok: true; orderId: number }
  | { ok: false; error: "invalid" | "expired" | "revoked" };

export async function hasActivePackAccessToken(orderId: number): Promise<boolean> {
  if (!Number.isFinite(orderId) || orderId <= 0) return false;
  const now = new Date();
  const row = await prisma.packAccessToken.findFirst({
    where: {
      orderId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getOrderIdForPackAccessToken(token: string): Promise<PackTokenLookupResult> {
  const trimmed = String(token || "").trim();
  if (!trimmed) return { ok: false, error: "invalid" };
  const tokenHash = hashToken(trimmed);
  const row = await prisma.packAccessToken.findUnique({
    where: { tokenHash },
    select: { id: true, orderId: true, expiresAt: true, revokedAt: true },
  });
  if (!row) return { ok: false, error: "invalid" };
  if (row.revokedAt) return { ok: false, error: "revoked" };
  if (row.expiresAt && row.expiresAt <= new Date()) return { ok: false, error: "expired" };

  await prisma.packAccessToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return { ok: true, orderId: row.orderId };
}
