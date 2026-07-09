/**
 * Bridge SQL para seed en staging cuando el cliente Prisma está adelantado
 * respecto a las migraciones aplicadas en Neon (columnas faltantes en User/Album/Photo).
 * No modifica schema; solo evita SELECT/RETURN de columnas inexistentes.
 */
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@repo/db";

export type StagingUserRow = { id: number; email: string };

export async function upsertStagingUser(params: {
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  defaultDigitalPhotoPrice: number;
  publicPageHandler: string;
}): Promise<StagingUserRow> {
  const rows = await prisma.$queryRaw<StagingUserRow[]>(Prisma.sql`
    INSERT INTO "User" (
      email,
      password,
      role,
      name,
      "defaultDigitalPhotoPrice",
      "isPublicPageEnabled",
      "publicPageHandler",
      "enableAlbumsPage",
      "enablePrintPage",
      "emailVerifiedAt",
      city,
      country,
      "isBlocked"
    )
    VALUES (
      ${params.email},
      ${params.passwordHash},
      CAST(${params.role} AS "Role"),
      ${params.name},
      ${params.defaultDigitalPhotoPrice},
      true,
      ${params.publicPageHandler},
      true,
      false,
      NOW(),
      'Buenos Aires',
      'Argentina',
      false
    )
    ON CONFLICT (email) DO UPDATE SET
      password = EXCLUDED.password,
      role = EXCLUDED.role,
      name = EXCLUDED.name,
      "defaultDigitalPhotoPrice" = EXCLUDED."defaultDigitalPhotoPrice",
      "isPublicPageEnabled" = EXCLUDED."isPublicPageEnabled",
      "publicPageHandler" = EXCLUDED."publicPageHandler",
      "enableAlbumsPage" = EXCLUDED."enableAlbumsPage",
      "enablePrintPage" = EXCLUDED."enablePrintPage",
      "emailVerifiedAt" = EXCLUDED."emailVerifiedAt",
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      "isBlocked" = false
    RETURNING id, email
  `);

  const row = rows[0];
  if (!row) throw new Error(`upsertStagingUser failed for ${params.email}`);
  return row;
}

export type StagingAlbumRow = { id: number; publicSlug: string };

export async function upsertStagingAlbum(params: {
  userId: number;
  publicSlug: string;
  title: string;
  location: string;
  digitalPhotoPriceCents: number;
  termsVersion: string;
  eventDate: Date;
  expiresAt: Date;
}): Promise<StagingAlbumRow> {
  const rows = await prisma.$queryRaw<StagingAlbumRow[]>(Prisma.sql`
    INSERT INTO "Album" (
      "userId",
      "creatorId",
      title,
      location,
      "publicSlug",
      "eventDate",
      "firstPhotoDate",
      "isPublic",
      "isHidden",
      "enableDigitalPhotos",
      "enablePrintedPhotos",
      "digitalPhotoPriceCents",
      "termsAcceptedAt",
      "termsVersion",
      "expiresAt",
      city
    )
    VALUES (
      ${params.userId},
      ${params.userId},
      ${params.title},
      ${params.location},
      ${params.publicSlug},
      ${params.eventDate},
      ${params.eventDate},
      true,
      false,
      true,
      false,
      ${params.digitalPhotoPriceCents},
      NOW(),
      ${params.termsVersion},
      ${params.expiresAt},
      'Buenos Aires'
    )
    ON CONFLICT ("publicSlug") DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "creatorId" = EXCLUDED."creatorId",
      title = EXCLUDED.title,
      location = EXCLUDED.location,
      "eventDate" = EXCLUDED."eventDate",
      "firstPhotoDate" = EXCLUDED."firstPhotoDate",
      "isPublic" = EXCLUDED."isPublic",
      "isHidden" = EXCLUDED."isHidden",
      "enableDigitalPhotos" = EXCLUDED."enableDigitalPhotos",
      "enablePrintedPhotos" = EXCLUDED."enablePrintedPhotos",
      "digitalPhotoPriceCents" = EXCLUDED."digitalPhotoPriceCents",
      "termsAcceptedAt" = EXCLUDED."termsAcceptedAt",
      "termsVersion" = EXCLUDED."termsVersion",
      "expiresAt" = EXCLUDED."expiresAt",
      city = EXCLUDED.city,
      "deletedAt" = NULL
    RETURNING id, "publicSlug"
  `);

  const row = rows[0];
  if (!row) throw new Error(`upsertStagingAlbum failed for ${params.publicSlug}`);
  return row;
}

export async function findStagingPhotoId(
  albumId: number,
  originalKey: string
): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT id FROM "Photo"
    WHERE "albumId" = ${albumId} AND "originalKey" = ${originalKey}
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

export async function createStagingPhoto(params: {
  albumId: number;
  userId: number;
  previewUrl: string;
  originalKey: string;
}): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    INSERT INTO "Photo" (
      "albumId",
      "userId",
      "previewUrl",
      "originalKey",
      "sellDigital",
      "sellPrint"
    )
    VALUES (
      ${params.albumId},
      ${params.userId},
      ${params.previewUrl},
      ${params.originalKey},
      true,
      false
    )
    RETURNING id
  `);
  const row = rows[0];
  if (!row) throw new Error("createStagingPhoto failed");
  return row.id;
}

export async function setAlbumCoverPhotoId(
  albumId: number,
  coverPhotoId: number
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Album" SET "coverPhotoId" = ${coverPhotoId} WHERE id = ${albumId}
  `);
}

export async function countStagingPhotosForAlbum(albumId: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "Photo"
    WHERE "albumId" = ${albumId} AND COALESCE("isRemoved", false) = false
  `);
  return rows[0]?.count ?? 0;
}
