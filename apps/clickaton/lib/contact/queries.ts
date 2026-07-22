import { prisma, withClickatonDb, type ClickatonDbResult } from "@/lib/admin/db";

export type ContactMessageListItem = {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  reason: string;
  message: string;
  source: string;
  isRead: boolean;
  readAt: Date | null;
};

export async function listContactMessages(options?: {
  unreadOnly?: boolean;
}): Promise<ClickatonDbResult<ContactMessageListItem[]>> {
  return withClickatonDb(async () => {
    return prisma.clickatonContactMessage.findMany({
      where: {
        archivedAt: null,
        ...(options?.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        name: true,
        email: true,
        company: true,
        phone: true,
        reason: true,
        message: true,
        source: true,
        isRead: true,
        readAt: true,
      },
    });
  });
}

export async function countUnreadContactMessages(): Promise<
  ClickatonDbResult<number>
> {
  return withClickatonDb(async () => {
    return prisma.clickatonContactMessage.count({
      where: { archivedAt: null, isRead: false },
    });
  });
}

export async function getContactMessageById(
  id: string,
): Promise<ClickatonDbResult<ContactMessageListItem | null>> {
  return withClickatonDb(async () => {
    return prisma.clickatonContactMessage.findFirst({
      where: { id, archivedAt: null },
      select: {
        id: true,
        createdAt: true,
        name: true,
        email: true,
        company: true,
        phone: true,
        reason: true,
        message: true,
        source: true,
        isRead: true,
        readAt: true,
      },
    });
  });
}
