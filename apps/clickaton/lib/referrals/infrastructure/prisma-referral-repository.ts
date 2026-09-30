import { prisma } from "@repo/db";

import { generateReferralCode } from "../domain/code";
import type {
  ReferralAttributionRecord,
  ReferralCodeRecord,
  ReferralRepository,
} from "../domain/repository";

type CodeRow = NonNullable<
  Awaited<ReturnType<typeof prisma.clickatonReferralCode.findFirst>>
>;
type AttributionRow = NonNullable<
  Awaited<ReturnType<typeof prisma.clickatonReferralAttribution.findFirst>>
>;

function toCodeRecord(row: CodeRow): ReferralCodeRecord {
  return { id: row.id, userId: row.userId, code: row.code, isActive: row.isActive };
}

function toAttributionRecord(row: AttributionRow): ReferralAttributionRecord {
  return {
    id: row.id,
    referrerUserId: row.referrerUserId,
    referredUserId: row.referredUserId,
    referredEmail: row.referredEmail,
    referralCodeId: row.referralCodeId,
    registrationId: row.registrationId,
    editionId: row.editionId,
    status: row.status,
    earnedAt: row.earnedAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
    consumedAt: row.consumedAt,
    consumedRegistrationId: row.consumedRegistrationId,
  };
}

export const prismaReferralRepository: ReferralRepository = {
  async findCodeByCode(code) {
    const row = await prisma.clickatonReferralCode.findUnique({ where: { code } });
    return row ? toCodeRecord(row) : null;
  },

  async findCodeByUserId(userId) {
    const row = await prisma.clickatonReferralCode.findUnique({ where: { userId } });
    return row ? toCodeRecord(row) : null;
  },

  async createCode({ userId, code }) {
    const row = await prisma.clickatonReferralCode.create({ data: { userId, code } });
    return toCodeRecord(row);
  },

  async findUserEmail(userId) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return row?.email ?? null;
  },

  async findUserIdByEmail(email) {
    const limpio = email.trim();
    if (!limpio) return null;
    const row = await prisma.user.findFirst({
      where: { email: { equals: limpio, mode: "insensitive" } },
      select: { id: true },
    });
    return row?.id ?? null;
  },

  async tieneInscripcionConfirmada(userId) {
    const count = await prisma.clickatonRegistration.count({
      where: { userId, status: "CONFIRMED" },
    });
    return count > 0;
  },

  async findAttributionByReferredUserId(referredUserId) {
    const row = await prisma.clickatonReferralAttribution.findFirst({
      where: { referredUserId, status: { not: "REVOKED" } },
    });
    return row ? toAttributionRecord(row) : null;
  },

  async findAttributionByRegistrationId(registrationId) {
    const row = await prisma.clickatonReferralAttribution.findUnique({
      where: { registrationId },
    });
    return row ? toAttributionRecord(row) : null;
  },

  async createAttribution(input) {
    const row = await prisma.clickatonReferralAttribution.create({ data: input });
    return toAttributionRecord(row);
  },

  async revokeAttribution({ registrationId, reason }) {
    const existing = await prisma.clickatonReferralAttribution.findUnique({
      where: { registrationId },
    });
    if (!existing || existing.status !== "EARNED") return null;

    const row = await prisma.clickatonReferralAttribution.update({
      where: { registrationId },
      data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
    });
    return toAttributionRecord(row);
  },

  async contarColegasTraidos(referrerUserId) {
    return prisma.clickatonReferralAttribution.count({
      where: { referrerUserId, status: "EARNED" },
    });
  },

  async reservarAtribuciones({ referrerUserId, cantidad, ref }) {
    if (cantidad <= 0) return 0;

    return prisma.$transaction(async (tx) => {
      // FOR UPDATE SKIP LOCKED: dos inscripciones simultáneas del mismo usuario
      // no pueden llevarse la misma atribución. La que llega segunda ve menos
      // colegas disponibles, que es exactamente lo que debe pasar.
      const elegibles = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ClickatonReferralAttribution"
        WHERE "referrerUserId" = ${referrerUserId} AND "status" = 'EARNED'
        ORDER BY "earnedAt" ASC
        LIMIT ${cantidad}
        FOR UPDATE SKIP LOCKED
      `;
      if (elegibles.length === 0) return 0;

      const { count } = await tx.clickatonReferralAttribution.updateMany({
        where: { id: { in: elegibles.map((row) => row.id) }, status: "EARNED" },
        data: { status: "RESERVED", consumedRegistrationId: ref },
      });
      return count;
    });
  },

  async adjuntarReserva({ ref, registrationId }) {
    const { count } = await prisma.clickatonReferralAttribution.updateMany({
      where: { consumedRegistrationId: ref, status: "RESERVED" },
      data: { consumedRegistrationId: registrationId },
    });
    return count;
  },

  async confirmarAtribucionesReservadas(registrationId) {
    const { count } = await prisma.clickatonReferralAttribution.updateMany({
      where: { consumedRegistrationId: registrationId, status: "RESERVED" },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
    return count;
  },

  async liberarAtribucionesReservadas(registrationId) {
    const { count } = await prisma.clickatonReferralAttribution.updateMany({
      where: { consumedRegistrationId: registrationId, status: "RESERVED" },
      data: { status: "EARNED", consumedRegistrationId: null },
    });
    return count;
  },

  async recordAttempt(input) {
    await prisma.clickatonReferralAttributionAttempt.create({
      data: {
        code: input.code,
        outcome: input.outcome,
        referrerUserId: input.referrerUserId ?? null,
        referredUserId: input.referredUserId ?? null,
        referredEmail: input.referredEmail ?? null,
        registrationId: input.registrationId ?? null,
        detail: input.detail ?? null,
      },
    });
  },
};

/**
 * El código del link se crea on-demand, la primera vez que la persona entra a
 * su panel. Reintenta ante una colisión de código: con ~24 bits el choque es
 * improbable pero no imposible, y fallar dejaría a alguien sin su link.
 */
export async function obtenerOCrearCodigoDeReferido(
  userId: number,
): Promise<ReferralCodeRecord> {
  const existente = await prismaReferralRepository.findCodeByUserId(userId);
  if (existente) return existente;

  let ultimoError: unknown = null;
  for (let intento = 0; intento < 5; intento += 1) {
    try {
      return await prismaReferralRepository.createCode({
        userId,
        code: generateReferralCode(),
      });
    } catch (error) {
      ultimoError = error;
      // Carrera: otra pestaña creó el código del mismo usuario primero.
      const yaCreado = await prismaReferralRepository.findCodeByUserId(userId);
      if (yaCreado) return yaCreado;
    }
  }
  throw ultimoError ?? new Error("No se pudo generar el código de referido.");
}
