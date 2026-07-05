import { prisma } from "../lib/prisma";

/**
 * Asigna la primera foto como portada a todos los álbumes que no tienen portada
 * y que tienen al menos una foto cargada.
 *
 * Ejecutar con: npx tsx scripts/assign-album-covers.ts
 */

async function main() {
  console.log("📷 Asignando portadas a álbumes sin cover...\n");

  const albumsWithoutCover = await prisma.album.findMany({
    where: {
      coverPhotoId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          photos: { where: { isRemoved: false } },
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const album of albumsWithoutCover) {
    const photosCount = album._count.photos;
    if (photosCount === 0) {
      skipped++;
      continue;
    }

    const firstPhoto = await prisma.photo.findFirst({
      where: { albumId: album.id, isRemoved: false },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!firstPhoto) continue;

    await prisma.album.update({
      where: { id: album.id },
      data: { coverPhotoId: firstPhoto.id },
    });

    updated++;
    console.log(`   ✅ Álbum "${album.title}" (id ${album.id}) → portada = foto ${firstPhoto.id}`);
  }

  console.log(`\n📊 Resultado: ${updated} álbumes actualizados, ${skipped} sin fotos (omitidos)\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
