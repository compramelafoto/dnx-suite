"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export async function markContactMessageReadAction(messageId: string) {
  await requireClickatonAdmin();
  const result = await withClickatonDb(async () => {
    return prisma.clickatonContactMessage.update({
      where: { id: messageId },
      data: { isRead: true, readAt: new Date() },
      select: { id: true },
    });
  });
  if (result.ok) {
    revalidatePath(adminRoutes.messages);
    revalidatePath(`${adminRoutes.messages}/${messageId}`);
  }
  return result;
}

export async function archiveContactMessageAction(messageId: string) {
  await requireClickatonAdmin();
  const result = await withClickatonDb(async () => {
    return prisma.clickatonContactMessage.update({
      where: { id: messageId },
      data: { archivedAt: new Date(), isRead: true, readAt: new Date() },
      select: { id: true },
    });
  });
  if (result.ok) {
    revalidatePath(adminRoutes.messages);
  }
  return result;
}
