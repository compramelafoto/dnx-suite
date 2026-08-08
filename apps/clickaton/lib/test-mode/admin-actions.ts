"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  cleanupTestModeData,
  ensureTestRegistration,
  setTestVirtualClockCookie,
} from "./test-mode";

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";

export async function enterTestModeAction(editionId: string) {
  const user = await requireClickatonAdmin();
  if (editionId === COMMERCIAL_EDITION_ID) {
    // Permitido solo si Super Admin — aún así usa isOpsTest, no regs reales.
  }
  const { registrationId } = await ensureTestRegistration({
    editionId,
    actorUserId: user.id,
    actorEmail: user.email,
  });
  await setTestVirtualClockCookie(editionId, null);
  revalidatePath(`${adminRoutes.editions}/${editionId}`);
  redirect(`/mi-cuenta/inscripciones/${registrationId}?testMode=1`);
}

export async function setTestClockAction(editionId: string, formData: FormData) {
  await requireClickatonAdmin();
  const iso = String(formData.get("virtualClock") ?? "").trim();
  await setTestVirtualClockCookie(editionId, iso || null);
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
  revalidatePath(`${adminRoutes.editions}/${editionId}`);
}

export async function cleanupTestModeAction(editionId: string) {
  await requireClickatonAdmin();
  const before = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  await cleanupTestModeData({ editionId });
  const after = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  if (before !== after) {
    throw new Error("BLOCKED_CRITICAL_COMMERCIAL_COUNT_CHANGED");
  }
  revalidatePath(`${adminRoutes.editions}/${editionId}`);
}
