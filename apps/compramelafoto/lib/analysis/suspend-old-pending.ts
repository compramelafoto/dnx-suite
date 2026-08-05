import { prisma } from "@/lib/prisma";
import {
  analysisSuspendedByAgeMessage,
  photoCreatedAtCutoff,
} from "@/lib/analysis/analysis-age-policy";

export async function suspendOldPendingAnalysis(days: number) {
  const cutoff = photoCreatedAtCutoff(days);
  const message = analysisSuspendedByAgeMessage(days);

  const oldPending = await prisma.photo.findMany({
    where: {
      isRemoved: false,
      analysisStatus: { in: ["PENDING", "PROCESSING"] },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (oldPending.length === 0) {
    return { suspended: 0, jobsDeleted: 0, days, cutoff };
  }

  const photoIds = oldPending.map((p) => p.id);

  let jobsDeleted = 0;
  const chunk = 1000;
  for (let i = 0; i < photoIds.length; i += chunk) {
    const slice = photoIds.slice(i, i + chunk);
    const deleted = await prisma.photoAnalysisJob.deleteMany({
      where: { photoId: { in: slice } },
    });
    jobsDeleted += deleted.count;
    await prisma.photo.updateMany({
      where: { id: { in: slice } },
      data: {
        analysisStatus: "ERROR",
        analysisError: message,
      },
    });
  }

  return {
    suspended: photoIds.length,
    jobsDeleted,
    days,
    cutoff,
    message,
  };
}
