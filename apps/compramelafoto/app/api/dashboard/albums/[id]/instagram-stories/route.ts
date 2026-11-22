import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAlbumStoryConsent, setAlbumStoryConsent } from "@/lib/social/album-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function albumDelFotografo(params: Promise<{ id: string }>) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 }) };
  const albumId = Number((await params).id);
  if (!Number.isInteger(albumId)) return { res: NextResponse.json({ error: "ID inválido" }, { status: 400 }) };
  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { userId: true } });
  if (!album || album.userId !== user.id) {
    return { res: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { user, albumId };
}

/** Permiso de difusión en las historias de Instagram de CompraMeLaFoto (activado por defecto). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await albumDelFotografo(params);
  if ("res" in r) return r.res;
  return NextResponse.json(await getAlbumStoryConsent(r.albumId));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await albumDelFotografo(params);
  if ("res" in r) return r.res;
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown; extraHandles?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Falta indicar si se activa o no" }, { status: 400 });
  }
  if (body.extraHandles !== undefined && !Array.isArray(body.extraHandles)) {
    return NextResponse.json({ error: "La lista de cuentas no es válida" }, { status: 400 });
  }
  return NextResponse.json(
    await setAlbumStoryConsent({
      albumId: r.albumId,
      enabled: body.enabled,
      extraHandles: body.extraHandles,
      userId: r.user.id,
    }),
  );
}
