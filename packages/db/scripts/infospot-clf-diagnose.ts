import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const totalEvents = await p.event.count();
  const totalAlbums = await p.album.count();
  const albumsWithEvent = await p.album.count({ where: { eventId: { not: null } } });
  const albumsNotDeleted = await p.album.count({
    where: { deletedAt: null, eventId: { not: null } },
  });
  const totalPhotos = await p.photo.count();
  const activePhotos = await p.photo.count({ where: { isRemoved: false } });

  const sampleAlbums = await p.album.findMany({
    take: 10,
    orderBy: { id: "desc" },
    select: {
      id: true,
      title: true,
      eventId: true,
      deletedAt: true,
      _count: { select: { photos: true } },
    },
  });

  const sampleEvents = await p.event.findMany({
    take: 10,
    orderBy: { id: "desc" },
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      archivedAt: true,
      _count: { select: { albums: true } },
    },
  });

  // Raw-ish: albums that have any photos
  const albumsAnyPhotos = await p.$queryRawUnsafe<
    Array<{ id: number; title: string; eventId: number | null; photos: bigint }>
  >(
    `SELECT a.id, a.title, a."eventId", COUNT(p.id) as photos
     FROM "Album" a
     LEFT JOIN "Photo" p ON p."albumId" = a.id AND p."isRemoved" = false
     WHERE a."deletedAt" IS NULL
     GROUP BY a.id
     HAVING COUNT(p.id) > 0
     ORDER BY photos DESC
     LIMIT 20`,
  );

  console.log(
    JSON.stringify(
      {
        totalEvents,
        totalAlbums,
        albumsWithEvent,
        albumsNotDeleted,
        totalPhotos,
        activePhotos,
        sampleAlbums,
        sampleEvents,
        albumsAnyPhotos: albumsAnyPhotos.map((r) => ({
          ...r,
          photos: Number(r.photos),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
