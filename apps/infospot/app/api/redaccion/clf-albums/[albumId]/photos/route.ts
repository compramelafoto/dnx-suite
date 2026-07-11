import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getClfAlbumDetail, listClfPhotosForAlbum } from "@/lib/clf-queries";

type Ctx = { params: Promise<{ albumId: string }> };

export async function GET(request: Request, context: Ctx) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { albumId: raw } = await context.params;
  const albumId = Number(raw);
  if (!Number.isFinite(albumId) || albumId <= 0) {
    return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
  }

  const album = await getClfAlbumDetail(albumId);
  if (!album) return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const photographerRaw = searchParams.get("photographerId");
  const photographerId = photographerRaw ? Number(photographerRaw) : undefined;

  const photos = await listClfPhotosForAlbum(
    albumId,
    Number.isFinite(photographerId) ? photographerId : undefined,
  );

  return NextResponse.json({ album, photos });
}
