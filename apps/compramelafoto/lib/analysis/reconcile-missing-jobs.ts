import { prisma } from "@/lib/prisma";

type ReconcileResult = {
  created: number;
  photoIds: number[];
};

export async function reconcileMissingJobs(limit: number): Promise<ReconcileResult> {
  const missingPhotos = await prisma.photo.findMany({
    where: { analysisJob: null, isRemoved: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  if (missingPhotos.length === 0) {
    return { created: 0, photoIds: [] };
  }

  const photoIds = missingPhotos.map((p) => p.id);

  await prisma.photoAnalysisJob.createMany({
    data: photoIds.map((photoId) => ({
      photoId,
      status: "PENDING",
    })),
    skipDuplicates: true,
  });

  await prisma.photo.updateMany({
    where: { id: { in: photoIds } },
    data: { analysisStatus: "PENDING", analysisError: null },
  });

  return { created: photoIds.length, photoIds };
}
