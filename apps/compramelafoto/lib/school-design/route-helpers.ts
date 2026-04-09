import { prisma } from "@/lib/prisma";

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
