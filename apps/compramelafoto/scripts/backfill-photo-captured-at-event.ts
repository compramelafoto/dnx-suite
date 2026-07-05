import { prisma } from "@/lib/prisma";
import { readFromR2, urlToR2Key } from "@/lib/r2-client";
import { extractCapturedAtFromBuffer } from "@/lib/photo-exif";

function resolveOriginalKey(originalKey: string) {
  try {
    return urlToR2Key(originalKey);
  } catch {
    return originalKey.replace(/^\//, "");
  }
}

async function main() {
  const eventIdArg = process.argv[2];
  const eventId = eventIdArg ? Number(eventIdArg) : null;
  if (!eventId || !Number.isFinite(eventId)) {
    throw new Error("Uso: tsx scripts/backfill-photo-captured-at-event.ts <eventId>");
  }

  const photos = await prisma.photo.findMany({
    where: {
      album: {
        eventId,
      },
      isRemoved: false,
      capturedAt: null,
    },
    select: {
      id: true,
      originalKey: true,
    },
  });

  console.log(`Fotos a procesar: ${photos.length}`);

  let updated = 0;
  for (const photo of photos) {
    try {
      const key = resolveOriginalKey(photo.originalKey);
      const buffer = await readFromR2(key);
      const capturedAt = await extractCapturedAtFromBuffer(buffer);
      if (!capturedAt) continue;
      await prisma.photo.update({
        where: { id: photo.id },
        data: { capturedAt },
      });
      updated += 1;
      if (updated % 50 === 0) {
        console.log(`Actualizadas ${updated} fotos...`);
      }
    } catch (err) {
      console.warn(`No se pudo procesar foto ${photo.id}:`, err);
    }
  }

  console.log(`Backfill finalizado. Fotos actualizadas: ${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
