import { config } from "dotenv";
import { prisma } from "../lib/prisma";
import { urlToR2Key, readFromR2, fileExistsInR2 } from "../lib/r2-client";

config({ path: ".env.local" });
config({ path: ".env" });

function getR2KeyFromPhotoKey(originalKey: string): string {
  if (!originalKey?.trim()) return originalKey;
  if (originalKey.startsWith("http://") || originalKey.startsWith("https://")) {
    return urlToR2Key(originalKey);
  }
  if (originalKey.startsWith("uploads/") || originalKey.startsWith("albums/")) {
    return originalKey;
  }
  if (originalKey.startsWith("/")) {
    return originalKey.replace(/^\//, "");
  }
  return `uploads/${originalKey}`;
}

async function main() {
  const orderId = 1007;
  const job = await prisma.zipGenerationJob.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { productType: "DIGITAL" },
        include: { photo: { select: { id: true, originalKey: true } } },
      },
    },
  });

  console.log("job", {
    id: job?.id,
    r2Key: job?.r2Key,
    status: job?.status,
    processedItems: job?.processedItems,
    totalItems: job?.totalItems,
    error: job?.error,
  });

  for (const it of order?.items ?? []) {
    const key = it.photo?.originalKey ?? "";
    const wrong = urlToR2Key(key);
    const right = getR2KeyFromPhotoKey(key);
    const existsWrong = await fileExistsInR2(wrong).catch(() => false);
    const existsRight = await fileExistsInR2(right).catch(() => false);
    console.log({
      photoId: it.photo?.id,
      wrong,
      right,
      existsWrong,
      existsRight,
      keysMatch: wrong === right,
    });
  }

  if (job?.r2Key) {
    const exists = await fileExistsInR2(job.r2Key).catch(() => false);
    console.log("zip exists in R2?", exists, job.r2Key);
    if (exists) {
      const buf = await readFromR2(job.r2Key);
      console.log("zip size bytes", buf.length);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
