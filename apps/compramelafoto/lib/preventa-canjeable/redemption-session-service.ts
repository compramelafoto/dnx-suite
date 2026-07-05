import { prisma } from "@/lib/prisma";
import type { Prisma, RedemptionSession } from "@/lib/prisma";

export async function findActiveRedemptionSession(
  entitlementId: number
): Promise<RedemptionSession | null> {
  return prisma.redemptionSession.findFirst({
    where: { entitlementId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Prisma no expone unique parcial (una sola ACTIVE por entitlement). Deja una sola ACTIVE
 * (la más reciente por updatedAt) y marca el resto ABANDONED.
 */
export async function enforceSingleActiveRedemptionSessionPerEntitlement(
  entitlementId: number
): Promise<RedemptionSession | null> {
  const actives = await prisma.redemptionSession.findMany({
    where: { entitlementId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
  if (actives.length === 0) return null;
  const [keep, ...drop] = actives;
  for (const s of drop) {
    await prisma.redemptionSession.update({
      where: { id: s.id },
      data: { status: "ABANDONED" },
    });
  }
  return keep;
}

export async function createRedemptionSession(input: {
  entitlementId: number;
  albumId: number;
  clientGuestId?: string | null;
  buyerUserId?: number | null;
  stateJson?: Prisma.InputJsonValue;
  currentStep?: number;
  expiresAt?: Date | null;
}): Promise<RedemptionSession> {
  return prisma.redemptionSession.create({
    data: {
      entitlementId: input.entitlementId,
      albumId: input.albumId,
      clientGuestId: input.clientGuestId ?? null,
      buyerUserId: input.buyerUserId ?? null,
      stateJson: (input.stateJson ?? {}) as object,
      currentStep: input.currentStep ?? 1,
      status: "ACTIVE",
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/**
 * Sesión ACTIVE existente o nueva. Antes de crear, cierra duplicados ACTIVE (§3.2).
 */
export async function getOrCreateActiveRedemptionSession(input: {
  entitlementId: number;
  albumId: number;
  clientGuestId?: string | null;
  buyerUserId?: number | null;
  stateJson?: Prisma.InputJsonValue;
  currentStep?: number;
  expiresAt?: Date | null;
}): Promise<RedemptionSession> {
  await enforceSingleActiveRedemptionSessionPerEntitlement(input.entitlementId);
  const existing = await findActiveRedemptionSession(input.entitlementId);
  if (existing) return existing;
  return createRedemptionSession(input);
}

export async function patchRedemptionSession(
  id: string,
  data: {
    stateJson?: Prisma.InputJsonValue;
    currentStep?: number;
    status?: "ACTIVE" | "ABANDONED" | "COMPLETED";
    expiresAt?: Date | null;
  }
): Promise<RedemptionSession> {
  return prisma.redemptionSession.update({
    where: { id },
    data: {
      ...(data.stateJson !== undefined ? { stateJson: data.stateJson as object } : {}),
      ...(data.currentStep !== undefined ? { currentStep: data.currentStep } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
    },
  });
}

export async function markRedemptionSessionAbandoned(id: string): Promise<RedemptionSession> {
  return patchRedemptionSession(id, { status: "ABANDONED" });
}

export async function markRedemptionSessionCompleted(id: string): Promise<RedemptionSession> {
  return patchRedemptionSession(id, { status: "COMPLETED" });
}
