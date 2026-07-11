/**
 * Auditoría de eventos CLF candidatos para coberturas Info Spot.
 * Solo lectura. Compatible con DBs que aún no tienen columnas nuevas del schema.
 *
 * Uso: pnpm --filter @repo/db exec tsx scripts/infospot-clf-candidates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  // Query sin columnas que pueden faltar en staging (Event.status, Photo.storageDeletedAt).
  const events = await prisma.event.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      startsAt: { lt: now },
      title: { not: "" },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      city: true,
      locationName: true,
      type: true,
      visibility: true,
      creator: { select: { id: true, name: true, email: true } },
      albums: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          publicSlug: true,
          isHidden: true,
          isPublic: true,
          deletedAt: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
          user: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              photos: { where: { isRemoved: false } },
            },
          },
        },
      },
    },
    orderBy: { startsAt: "desc" },
    take: 120,
  });

  // También incluir eventos futuros con fotos (por si el lanzamiento cubre recientes).
  const upcomingWithAlbums = await prisma.event.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      startsAt: { gte: now },
      albums: { some: { deletedAt: null } },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      city: true,
      locationName: true,
      type: true,
      visibility: true,
      creator: { select: { id: true, name: true, email: true } },
      albums: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          publicSlug: true,
          isHidden: true,
          isPublic: true,
          deletedAt: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
          user: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              photos: { where: { isRemoved: false } },
            },
          },
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 40,
  });

  const byId = new Map<number, (typeof events)[number]>();
  for (const e of [...events, ...upcomingWithAlbums]) byId.set(e.id, e);

  const scored = [...byId.values()]
    .map((e) => {
      const albumCount = e.albums.length;
      const photoCount = e.albums.reduce((n, a) => n + a._count.photos, 0);
      const photographers = [
        ...new Map(
          e.albums.map((a) => [a.user.id, a.user.name?.trim() || a.user.email]),
        ).values(),
      ];

      // Disponibilidad comercial simplificada (sin importar helper que asume columnas nuevas).
      const commercialStatuses = e.albums.map((a) => {
        if (a.deletedAt || a.isHidden || !a.isPublic) return "UNAVAILABLE";
        if (a.cleanupStatus === "COMPLETED") return "UNAVAILABLE";
        return "AVAILABLE_OR_UNKNOWN";
      });
      const availableAlbums = commercialStatuses.filter((s) => s.startsWith("AVAILABLE")).length;

      const score =
        (photoCount > 0 ? 100 : 0) +
        Math.min(photoCount, 500) +
        albumCount * 10 +
        (e.city ? 5 : 0) +
        (e.locationName ? 3 : 0) +
        availableAlbums * 5 +
        (e.startsAt < now ? 20 : 0);

      const missing: string[] = [];
      if (!e.city?.trim()) missing.push("ciudad");
      if (!e.locationName?.trim()) missing.push("venue/locationName");
      if (albumCount === 0) missing.push("álbumes");
      if (photoCount === 0) missing.push("fotos");
      if (!e.creator.name?.trim()) missing.push("nombre organizador (solo email)");

      const available: string[] = [];
      if (e.title) available.push("título");
      if (e.startsAt) available.push("fecha");
      if (e.city) available.push("ciudad");
      if (e.locationName) available.push("lugar");
      if (e.type) available.push(`tipo:${e.type}`);
      if (albumCount) available.push(`${albumCount} álbum(es)`);
      if (photoCount) available.push(`${photoCount} foto(s)`);
      if (photographers.length) available.push(`fotógrafo(s): ${photographers.join(", ")}`);

      const topAlbum = [...e.albums].sort((a, b) => b._count.photos - a._count.photos)[0];

      return {
        eventId: e.id,
        nombre: e.title,
        fecha: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() ?? null,
        ciudad: e.city || null,
        lugar: e.locationName || null,
        provincia: null as string | null,
        tipo: e.type,
        visibility: e.visibility,
        organizador: e.creator.name?.trim() || e.creator.email,
        albumCount,
        photoCount,
        photographers,
        commercialStatuses: [...new Set(commercialStatuses)],
        availableAlbums,
        available,
        missing,
        score,
        topAlbumId: topAlbum?.id ?? null,
        topAlbumTitle: topAlbum?.title ?? null,
        occurred: e.startsAt < now,
      };
    })
    .filter((e) => e.photoCount > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  // Fallback: álbumes con fotos aunque el evento no pase filtros.
  let fallbackNote: string | null = null;
  if (scored.length === 0) {
    const albums = await prisma.album.findMany({
      where: {
        deletedAt: null,
        eventId: { not: null },
        photos: { some: { isRemoved: false } },
      },
      take: 40,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        eventId: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            city: true,
            locationName: true,
            type: true,
            visibility: true,
            archivedAt: true,
            creator: { select: { name: true, email: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { photos: { where: { isRemoved: false } } } },
      },
    });
    fallbackNote = "Sin eventos pasados con fotos vía join; listado por álbumes vinculados.";
    for (const a of albums) {
      if (!a.event || a.event.archivedAt) continue;
      if (scored.some((s) => s.eventId === a.event!.id)) continue;
      scored.push({
        eventId: a.event.id,
        nombre: a.event.title,
        fecha: a.event.startsAt.toISOString(),
        endsAt: null,
        ciudad: a.event.city || null,
        lugar: a.event.locationName || null,
        provincia: null,
        tipo: a.event.type,
        visibility: a.event.visibility,
        organizador: a.event.creator.name?.trim() || a.event.creator.email,
        albumCount: 1,
        photoCount: a._count.photos,
        photographers: [a.user.name?.trim() || a.user.email],
        commercialStatuses: ["AVAILABLE_OR_UNKNOWN"],
        availableAlbums: 1,
        available: ["título", "fecha", "álbum", "fotos"],
        missing: [],
        score: a._count.photos,
        topAlbumId: a.id,
        topAlbumTitle: a.title,
        occurred: a.event.startsAt < now,
      });
      if (scored.length >= 30) break;
    }
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        count: scored.length,
        fallbackNote,
        candidates: scored.slice(0, 30),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
