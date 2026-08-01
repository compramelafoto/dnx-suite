import { prisma } from "@repo/db";
import {
  MARATHON_PACK,
  isMarathonPackTicketCode,
  marathonPackExpiresAt,
} from "@/lib/packs/marathon-pack";

/**
 * Tras confirmar pago de PACK_4: crea ANNUAL_PASS (4 créditos / 2 años)
 * y consume 1 crédito por esta edición (idempotente).
 */
export async function grantAnnualPassAfterPackPurchase(input: {
  registrationId: string;
  userId: number;
  editionId: string;
  purchasePriceMinor: number;
}): Promise<{ entitlementId: string; created: boolean }> {
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      id: true,
      ticketType: { select: { code: true } },
      status: true,
    },
  });
  if (!registration || !isMarathonPackTicketCode(registration.ticketType.code)) {
    throw new Error("not_a_pack_registration");
  }

  const cycleKey = `pack4:reg:${input.registrationId}`;
  const existing = await prisma.clickatonUserEntitlement.findFirst({
    where: { userId: input.userId, type: "ANNUAL_PASS", cycleKey },
    select: { id: true },
  });

  const entitlementId =
    existing?.id ??
    (
      await prisma.clickatonUserEntitlement.create({
        data: {
          userId: input.userId,
          type: "ANNUAL_PASS",
          status: "ACTIVE",
          sourceEditionId: input.editionId,
          startingEditionId: input.editionId,
          purchasedAt: new Date(),
          purchasePriceMinor: input.purchasePriceMinor,
          startsAt: new Date(),
          expiresAt: marathonPackExpiresAt(),
          totalCredits: MARATHON_PACK.credits,
          consumedCredits: 0,
          cycleKey,
          metadata: { registrationId: input.registrationId, kind: "PACK_4" },
        },
        select: { id: true },
      })
    ).id;

  await consumePassCreditForRegistration({
    entitlementId,
    userId: input.userId,
    editionId: input.editionId,
    registrationId: input.registrationId,
  });

  return { entitlementId, created: !existing };
}

export async function findActivePassCreditsForUser(userId: number): Promise<{
  entitlementId: string;
  remaining: number;
  expiresAt: Date | null;
} | null> {
  const now = new Date();
  const rows = await prisma.clickatonUserEntitlement.findMany({
    where: {
      userId,
      type: "ANNUAL_PASS",
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });
  for (const row of rows) {
    const total = row.totalCredits ?? 0;
    const remaining = Math.max(0, total - row.consumedCredits);
    if (remaining > 0) {
      return {
        entitlementId: row.id,
        remaining,
        expiresAt: row.expiresAt,
      };
    }
  }
  return null;
}

export async function findActivePassCreditsForEmail(email: string): Promise<{
  entitlementId: string;
  remaining: number;
  expiresAt: Date | null;
  userId: number;
} | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return null;
  const pass = await findActivePassCreditsForUser(user.id);
  if (!pass) return null;
  return { ...pass, userId: user.id };
}

/**
 * Revierte un consumo por registrationId (si confirmación free falló después del canje).
 */
export async function reversePassCreditConsumption(input: {
  entitlementId: string;
  registrationId: string;
}): Promise<void> {
  const idempotencyKey = `registration:${input.registrationId}`;
  await prisma.$transaction(async (tx) => {
    const row = await tx.clickatonEntitlementConsumption.findUnique({
      where: {
        entitlementId_idempotencyKey: {
          entitlementId: input.entitlementId,
          idempotencyKey,
        },
      },
    });
    if (!row) return;
    await tx.clickatonEntitlementConsumption.delete({ where: { id: row.id } });
    const ent = await tx.clickatonUserEntitlement.findUnique({
      where: { id: input.entitlementId },
    });
    if (!ent) return;
    const next = Math.max(0, ent.consumedCredits - 1);
    await tx.clickatonUserEntitlement.update({
      where: { id: ent.id },
      data: {
        consumedCredits: next,
        status: ent.status === "EXHAUSTED" ? "ACTIVE" : ent.status,
        usedAt: ent.status === "EXHAUSTED" ? null : ent.usedAt,
      },
    });
  });
}

/**
 * Descuenta 1 crédito del pack al confirmar inscripción (idempotente por registrationId).
 */
export async function consumePassCreditForRegistration(input: {
  entitlementId: string;
  userId: number;
  editionId: string;
  registrationId: string;
}): Promise<{ ok: true; remaining: number } | { ok: false; reason: string }> {
  const idempotencyKey = `registration:${input.registrationId}`;
  return prisma.$transaction(async (tx) => {
    const already = await tx.clickatonEntitlementConsumption.findUnique({
      where: {
        entitlementId_idempotencyKey: {
          entitlementId: input.entitlementId,
          idempotencyKey,
        },
      },
    });
    if (already) {
      const ent = await tx.clickatonUserEntitlement.findUniqueOrThrow({
        where: { id: input.entitlementId },
      });
      const total = ent.totalCredits ?? 0;
      return { ok: true as const, remaining: Math.max(0, total - ent.consumedCredits) };
    }

    const ent = await tx.clickatonUserEntitlement.findFirst({
      where: {
        id: input.entitlementId,
        userId: input.userId,
        type: "ANNUAL_PASS",
        status: "ACTIVE",
      },
    });
    if (!ent) return { ok: false as const, reason: "NOT_FOUND" };
    if (ent.expiresAt && ent.expiresAt.getTime() <= Date.now()) {
      await tx.clickatonUserEntitlement.update({
        where: { id: ent.id },
        data: { status: "EXPIRED" },
      });
      return { ok: false as const, reason: "EXPIRED" };
    }
    const total = ent.totalCredits ?? 0;
    if (ent.consumedCredits >= total) {
      return { ok: false as const, reason: "NO_CREDITS" };
    }

    const nextConsumed = ent.consumedCredits + 1;
    const exhausted = nextConsumed >= total;
    await tx.clickatonUserEntitlement.update({
      where: { id: ent.id },
      data: {
        consumedCredits: nextConsumed,
        status: exhausted ? "EXHAUSTED" : "ACTIVE",
        usedAt: exhausted ? new Date() : ent.usedAt,
      },
    });
    await tx.clickatonEntitlementConsumption.create({
      data: {
        entitlementId: ent.id,
        editionId: input.editionId,
        eventType: "REGISTRATION_CONFIRMED",
        idempotencyKey,
        metadata: { registrationId: input.registrationId },
      },
    });
    return { ok: true as const, remaining: Math.max(0, total - nextConsumed) };
  });
}
