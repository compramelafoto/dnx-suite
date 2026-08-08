// @ts-nocheck — schema drift BenefitSyncRun/accessKey vs Prisma client (mismo caso adapter Partners)
import { prisma } from "@repo/db";
import {
  normalizeEligibilityEmail,
  type ClickatonEligibilitySnapshot,
} from "@repo/partners";
import { readPrizeAssignmentAudit } from "@/lib/admin/prize-assignments/audit";

/**
 * Carga snapshot mínimo para evaluar audiencias Clickatón.
 * Sin PII innecesaria más allá de email (solo para resolve exacto).
 */
export async function loadClickatonEligibilitySnapshot(
  editionId: string,
): Promise<ClickatonEligibilitySnapshot> {
  const registrations = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    select: {
      id: true,
      editionId: true,
      userId: true,
      email: true,
      status: true,
      paymentStatus: true,
    },
  });

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId, categoryId: { not: null } },
    select: { id: true, categoryId: true },
  });
  const promptCategory = new Map(
    prompts.filter((p) => p.categoryId).map((p) => [p.id, p.categoryId!]),
  );

  const categoryByRegistration = new Map<string, Set<string>>();
  if (prompts.length > 0) {
    const submissions = await prisma.clickatonPhotoSubmission.findMany({
      where: {
        editionId,
        promptId: { in: prompts.map((p) => p.id) },
      },
      select: { registrationId: true, promptId: true },
    });
    for (const s of submissions) {
      const cat = promptCategory.get(s.promptId);
      if (!cat) continue;
      const set = categoryByRegistration.get(s.registrationId) ?? new Set();
      set.add(cat);
      categoryByRegistration.set(s.registrationId, set);
    }
  }

  const prizeAssignments = await prisma.clickatonPrizeAssignment.findMany({
    where: {
      editionId,
      winnerRegistrationId: { not: null },
      replacedAt: null,
      bundle: { status: { in: ["ASSIGNED", "DELIVERED"] } },
    },
    select: {
      id: true,
      winnerRegistrationId: true,
      promptId: true,
      auditJson: true,
      bundle: { select: { id: true } },
    },
  });

  const winnerRegIds = [
    ...new Set(
      prizeAssignments
        .map((a) => a.winnerRegistrationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const winnerRegs =
    winnerRegIds.length > 0
      ? await prisma.clickatonRegistration.findMany({
          where: { id: { in: winnerRegIds }, editionId },
          select: { id: true, userId: true, email: true },
        })
      : [];
  const winnerRegMap = new Map(winnerRegs.map((r) => [r.id, r]));

  const finalists: ClickatonEligibilitySnapshot["finalists"] = [];

  const userIds = new Set<number>();
  for (const r of registrations) {
    if (r.userId != null) userIds.add(r.userId);
  }
  for (const w of winnerRegs) {
    if (w.userId != null) userIds.add(w.userId);
  }

  const emails = [
    ...new Set(
      registrations
        .map((r) => normalizeEligibilityEmail(r.email))
        .filter((e): e is string => Boolean(e)),
    ),
  ];

  const usersByEmail =
    emails.length > 0
      ? await prisma.user.findMany({
          where: {
            email: { in: emails, mode: "insensitive" },
          },
          select: { id: true, email: true },
        })
      : [];

  const emailToUserId = new Map<string, number>();
  for (const u of usersByEmail) {
    const norm = normalizeEligibilityEmail(u.email);
    if (norm) {
      emailToUserId.set(norm, u.id);
      userIds.add(u.id);
    }
  }

  const known =
    userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true },
        })
      : [];
  const knownUserIds = new Set(known.map((u) => u.id));

  return {
    editionId,
    registrations: registrations.map((r) => ({
      registrationId: r.id,
      editionId: r.editionId,
      userId: r.userId,
      email: r.email,
      status: r.status,
      paymentStatus: r.paymentStatus,
      categoryIds: [...(categoryByRegistration.get(r.id) ?? [])],
      cancelled: ["CANCELLED", "REFUNDED", "EXPIRED", "DISQUALIFIED"].includes(r.status),
    })),
    winners: prizeAssignments
      .filter(
        (a) => a.winnerRegistrationId && winnerRegMap.has(a.winnerRegistrationId),
      )
      .map((a) => {
        const reg = winnerRegMap.get(a.winnerRegistrationId!)!;
        const audit = readPrizeAssignmentAudit(a.auditJson);
        const categoryId = a.promptId ? (promptCategory.get(a.promptId) ?? null) : null;
        return {
          registrationId: reg.id,
          assignmentId: a.id,
          prizeBundleId: a.bundle.id,
          categoryId,
          winnerVersion: audit.winnerVersion,
          userId: reg.userId,
          email: reg.email,
        };
      }),
    finalists,
    knownUserIds,
    emailToUserId,
  };
}
