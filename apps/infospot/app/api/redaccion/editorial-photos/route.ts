import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getClfReadonlyClient, probeClfReadonlyConnection } from "@/lib/clf-readonly-db";
import { resolveClfAlbumCommercialAvailability } from "@repo/db";
import { buildClfThumbApiPath } from "@/lib/editorial-photo-previews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/redaccion/editorial-photos?albumId=&cursor=&take=&photographerId=
 * Lista paginada de fotos CLF para el selector (sin keys privadas ni original).
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const albumId = Number(req.nextUrl.searchParams.get("albumId") || 0);
  const take = Math.min(48, Math.max(1, Number(req.nextUrl.searchParams.get("take") || 24)));
  const cursor = Number(req.nextUrl.searchParams.get("cursor") || 0);
  const photographerId = Number(req.nextUrl.searchParams.get("photographerId") || 0);

  if (!albumId) {
    return NextResponse.json({ error: "albumId requerido" }, { status: 400 });
  }

  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) {
    return NextResponse.json({ error: probe.error || "CLF no disponible" }, { status: 503 });
  }

  const clf = getClfReadonlyClient();
  const album = await clf.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      isPublic: true,
      isHidden: true,
      deletedAt: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
      cleanupStatus: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!album) {
    return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
  }

  const avail = resolveClfAlbumCommercialAvailability(album);
  const photos = await clf.photo.findMany({
    where: {
      albumId,
      isRemoved: false,
      storageDeletedAt: null,
      ...(photographerId > 0 ? { userId: photographerId } : {}),
      ...(cursor > 0 ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: "desc" },
    take: take + 1,
    select: {
      id: true,
      userId: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const hasMore = photos.length > take;
  const page = hasMore ? photos.slice(0, take) : photos;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  // Enrich with existing editorial status
  const ids = page.map((p) => String(p.id));
  const existing = await prisma.infoSpotEditorialPhoto.findMany({
    where: { sourcePhotoExternalId: { in: ids } },
    select: {
      sourcePhotoExternalId: true,
      processStatus: true,
      commercialStatus: true,
      editorialLicenseStatus: true,
      id: true,
    },
  });
  const byExt = new Map(existing.map((e) => [e.sourcePhotoExternalId, e]));

  return NextResponse.json({
    album: {
      id: album.id,
      title: album.title,
      publicUrl: avail.publicUrl,
      commercialStatus: avail.status,
      commercialReason: avail.reason,
      photographerName: album.user.name?.trim() || album.user.email,
    },
    photos: page.map((p) => {
      const author = p.uploadedBy;
      const name = author?.name?.trim() || author?.email || "Fotógrafo";
      const ed = byExt.get(String(p.id));
      return {
        id: p.id,
        photographerId: author?.id ?? p.userId,
        photographerName: name,
        thumbApiPath: buildClfThumbApiPath(p.id, albumId),
        editorialPhotoId: ed?.id ?? null,
        processStatus: ed?.processStatus ?? null,
        commercialStatus: ed?.commercialStatus ?? null,
        licenseStatus: ed?.editorialLicenseStatus ?? null,
      };
    }),
    nextCursor,
    hasMore,
  });
}
