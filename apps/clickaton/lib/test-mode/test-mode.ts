/**
 * Modo Test / Vista como participante (ETAPA 12).
 * Aislado: isOpsTest=true, email @fotorank.test, no métricas comerciales.
 */
import { cookies } from "next/headers";
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@repo/db";
import { fixedClock, type EditionClock, systemClock } from "@/lib/timeline/clock";

export const TEST_CLOCK_COOKIE = "ck_test_virtual_clock";
export const TEST_MODE_COOKIE = "ck_test_mode_edition";
export const TEST_EMAIL_SUFFIX = "@fotorank.test";

export function isTestEmail(email: string): boolean {
  return /@fotorank\.test$/i.test(email);
}

export async function getTestVirtualClock(editionId: string): Promise<EditionClock> {
  const jar = await cookies();
  const modeEdition = jar.get(TEST_MODE_COOKIE)?.value;
  if (modeEdition !== editionId) return systemClock();
  const iso = jar.get(TEST_CLOCK_COOKIE)?.value;
  if (!iso) return systemClock();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return systemClock();
  return fixedClock(d);
}

export async function setTestVirtualClockCookie(editionId: string, iso: string | null) {
  const jar = await cookies();
  jar.set(TEST_MODE_COOKIE, editionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  if (!iso) {
    jar.delete(TEST_CLOCK_COOKIE);
    return;
  }
  jar.set(TEST_CLOCK_COOKIE, new Date(iso).toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

/**
 * Crea/reusa inscripción de prueba para Super Admin.
 * No crea pago real ni toca regs comerciales.
 */
export async function ensureTestRegistration(input: {
  editionId: string;
  actorUserId: number;
  actorEmail: string;
}): Promise<{ registrationId: string; email: string }> {
  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: input.editionId },
    select: { id: true, slug: true, timezone: true },
  });
  const ticket = await prisma.clickatonTicketType.findFirst({
    where: { editionId: edition.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!ticket) throw new Error("TEST_MODE_NO_TICKET");

  const email = `clickaton-test-${edition.id.slice(-8)}-${input.actorUserId}@fotorank.test`;
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Clickatón Test Mode",
      password: hashPassword(`CkTest-${randomBytes(3).toString("hex")}!`),
      role: "CUSTOMER",
      globalRole: "USER",
      emailVerifiedAt: new Date(),
    },
    update: { emailVerifiedAt: new Date() },
    select: { id: true, email: true },
  });

  const existing = await prisma.clickatonRegistration.findFirst({
    where: { editionId: edition.id, email, isOpsTest: true },
    select: { id: true },
  });
  if (existing) {
    return { registrationId: existing.id, email: user.email };
  }

  const reg = await prisma.clickatonRegistration.create({
    data: {
      editionId: edition.id,
      userId: user.id,
      email: user.email,
      firstName: "Test",
      lastName: "Mode",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "NOT_REQUIRED",
      isOpsTest: true,
      confirmedAt: new Date(),
      acceptedTermsAt: new Date(),
      acceptedImageAt: new Date(),
      sequenceNumber: 900_000 + (input.actorUserId % 1000),
      visibleCode: `TEST${edition.id.slice(-4).toUpperCase()}`,
    },
    select: { id: true },
  });

  // Nunca activar uploads comerciales desde Test Mode.
  // Si ya existe uploadConfig (edición real), no tocar uploadsEnabled.
  const existingConfig = await prisma.clickatonEditionUploadConfig.findUnique({
    where: { editionId: edition.id },
    select: { editionId: true },
  });
  if (!existingConfig) {
    await prisma.clickatonEditionUploadConfig.create({
      data: {
        editionId: edition.id,
        uploadsEnabled: false,
        canonicalAssetsEnabled: false,
      },
    });
  }

  return { registrationId: reg.id, email: user.email };
}

export async function cleanupTestModeData(input: {
  editionId: string;
}): Promise<{
  deletedRegs: number;
  deletedSubs: number;
  deletedUsers: number;
}> {
  const regs = await prisma.clickatonRegistration.findMany({
    where: { editionId: input.editionId, isOpsTest: true },
    select: { id: true, email: true, userId: true },
  });
  for (const r of regs) {
    if (!isTestEmail(r.email)) {
      throw new Error(`ABORT_NON_TEST_EMAIL:${r.email}`);
    }
  }
  const regIds = regs.map((r) => r.id);
  if (regIds.length === 0) {
    return { deletedRegs: 0, deletedSubs: 0, deletedUsers: 0 };
  }

  const subs = await prisma.clickatonPhotoSubmission.deleteMany({
    where: { registrationId: { in: regIds } },
  });
  await prisma.clickatonFotoRankSync.deleteMany({
    where: { registrationId: { in: regIds } },
  }).catch(() => null);

  const deletedRegs = await prisma.clickatonRegistration.deleteMany({
    where: { id: { in: regIds }, isOpsTest: true },
  });

  let deletedUsers = 0;
  for (const r of regs) {
    if (!r.userId) continue;
    const other = await prisma.clickatonRegistration.count({
      where: { userId: r.userId },
    });
    if (other === 0 && isTestEmail(r.email)) {
      await prisma.user.delete({ where: { id: r.userId } }).catch(() => null);
      deletedUsers += 1;
    }
  }

  return {
    deletedRegs: deletedRegs.count,
    deletedSubs: subs.count,
    deletedUsers,
  };
}
