import type { Prisma } from "@prisma/client";
import { DesignPreviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function updateRevisionDataJson(input: {
  revisionId: number;
  designProjectId: number;
  dataJson: Prisma.InputJsonValue;
}) {
  await prisma.$transaction([
    prisma.designRevision.update({
      where: { id: input.revisionId },
      data: { dataJson: input.dataJson },
    }),
    prisma.designProject.update({
      where: { id: input.designProjectId },
      data: {
        previewDirty: true,
        previewStatus: DesignPreviewStatus.DIRTY,
      },
    }),
  ]);
  console.log("[school_design_editor] revision dataJson updated", {
    revisionId: input.revisionId,
    designProjectId: input.designProjectId,
  });
}
