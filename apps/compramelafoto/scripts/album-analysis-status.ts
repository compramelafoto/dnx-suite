import { loadAnalysisEnv } from "./load-env-for-analysis";
loadAnalysisEnv();

async function main() {
  const albumId = Number(process.argv[2] || "749");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const groups = await prisma.photo.groupBy({
      by: ["analysisStatus"],
      where: { albumId, isRemoved: false },
      _count: { _all: true },
    });
    const faces = await prisma.faceDetection.count({
      where: { photo: { albumId, isRemoved: false } },
    });
    const ocrPhotos = await prisma.photo.count({
      where: { albumId, isRemoved: false, ocrTokens: { some: {} } },
    });
    const sample = await prisma.ocrToken.findMany({
      where: { photo: { albumId } },
      select: { textNorm: true },
      take: 25,
      orderBy: { id: "desc" },
    });
    console.log({
      groups,
      faces,
      ocrPhotos,
      sample: sample.map((s) => s.textNorm),
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
