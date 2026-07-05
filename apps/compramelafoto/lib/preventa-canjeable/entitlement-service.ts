import { prisma } from "@/lib/prisma";
import type { PackPurchaseEntitlement, PackPurchaseEntitlementStatus, Prisma } from "@/lib/prisma";

export async function getEntitlementByPreCompraOrderId(
  preCompraOrderId: number
): Promise<PackPurchaseEntitlement | null> {
  return prisma.packPurchaseEntitlement.findUnique({
    where: { preCompraOrderId },
  });
}

export async function getEntitlementById(id: number): Promise<PackPurchaseEntitlement | null> {
  return prisma.packPurchaseEntitlement.findUnique({ where: { id } });
}

/** Metadatos + vínculo preventa para APIs de canje / soporte. */
export async function getEntitlementWithPreCompra(id: number) {
  return prisma.packPurchaseEntitlement.findUnique({
    where: { id },
    include: {
      preCompraOrder: {
        select: {
          id: true,
          albumId: true,
          status: true,
          totalCents: true,
          buyerEmail: true,
          buyerUserId: true,
        },
      },
      redeemedOrder: { select: { id: true, status: true, albumId: true } },
    },
  });
}

export type CreateEntitlementDraftInput = {
  preCompraOrderId: number;
  albumId: number;
  buyerEmail: string;
  buyerUserId?: number | null;
  snapshotJson: Prisma.InputJsonValue;
  status?: PackPurchaseEntitlementStatus;
  expiresAt?: Date | null;
};

/**
 * Crea entitlement en UNPAID (o estado explícito). Congelación al cobrar: fase webhook / integración MP.
 */
export async function createPackPurchaseEntitlement(
  input: CreateEntitlementDraftInput
): Promise<PackPurchaseEntitlement> {
  return prisma.packPurchaseEntitlement.create({
    data: {
      preCompraOrderId: input.preCompraOrderId,
      albumId: input.albumId,
      buyerEmail: input.buyerEmail.trim().toLowerCase(),
      buyerUserId: input.buyerUserId ?? null,
      snapshotJson: input.snapshotJson as object,
      status: input.status ?? "UNPAID",
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/**
 * Actualiza estado y campos opcionales. No aplica máquina de estados completa §3.1 (siguiente fase).
 */
export async function updateEntitlementStatus(
  id: number,
  status: PackPurchaseEntitlementStatus,
  patch?: {
    paidAt?: Date | null;
    expiresAt?: Date | null;
    snapshotJson?: Prisma.InputJsonValue;
    redeemedOrderId?: number | null;
  }
): Promise<PackPurchaseEntitlement> {
  return prisma.packPurchaseEntitlement.update({
    where: { id },
    data: {
      status,
      ...(patch?.paidAt !== undefined ? { paidAt: patch.paidAt } : {}),
      ...(patch?.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
      ...(patch?.snapshotJson !== undefined ? { snapshotJson: patch.snapshotJson as object } : {}),
      ...(patch?.redeemedOrderId !== undefined ? { redeemedOrderId: patch.redeemedOrderId } : {}),
    },
  });
}
