import { prisma } from "@/lib/prisma";
import type { TemplateSlotInput } from "./validate-selection";

export type OwnedDesignProject = NonNullable<Awaited<ReturnType<typeof getOwnedDesignProject>>>;

export function slotsAndRolesFromOwnedProject(dp: OwnedDesignProject): {
  slots: TemplateSlotInput[];
  roleMap: Map<number, string | null>;
} {
  const slots: TemplateSlotInput[] = dp.template.slots.map((s) => ({
    id: s.id,
    pageIndex: s.pageIndex,
    index: s.index,
    role: s.role,
    bbox: s.bbox,
  }));
  const roleMap = new Map<number, string | null>(
    dp.orderItem.selection?.photos.map((sp) => [sp.photoId, sp.role ?? null]) ?? []
  );
  return { slots, roleMap };
}

export async function getOwnedDesignProject(albumId: number, designProjectId: number, photographerUserId: number) {
  return prisma.designProject.findFirst({
    where: {
      id: designProjectId,
      orderItem: {
        order: {
          albumId,
          album: { userId: photographerUserId },
        },
      },
    },
    include: {
      template: { include: { slots: true } },
      currentRevision: true,
      orderItem: {
        include: {
          selection: {
            include: {
              photos: {
                orderBy: { position: "asc" },
                include: { photo: true },
              },
            },
          },
        },
      },
    },
  });
}
