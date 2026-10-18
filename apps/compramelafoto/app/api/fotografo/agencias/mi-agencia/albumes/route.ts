import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const linked = await prisma.agencyAlbum.findMany({
    where: { agencyId: a.agency.id, album: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { albumId: true, album: { select: { title: true, publicSlug: true } } },
  });
  const available = await prisma.album.findMany({
    where: { userId: a.user.id, deletedAt: null, agencyAlbum: { is: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, title: true },
  });
  return NextResponse.json({
    linked: linked.map((l) => ({ albumId: l.albumId, title: l.album.title, publicSlug: l.album.publicSlug })),
    available: available.map((al) => ({ albumId: al.id, title: al.title })),
  });
}

export async function POST(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { albumId?: unknown };
  const albumId = Number(body.albumId);
  if (!Number.isInteger(albumId) || albumId <= 0) return NextResponse.json({ error: "Elegí un álbum." }, { status: 400 });
  const album = await prisma.album.findFirst({
    where: { id: albumId, userId: a.user.id, deletedAt: null },
    select: { id: true, agencyAlbum: { select: { id: true } } },
  });
  if (!album) return NextResponse.json({ error: "Ese álbum no es tuyo o no existe." }, { status: 404 });
  if (album.agencyAlbum) return NextResponse.json({ error: "Ese álbum ya es de la agencia." }, { status: 409 });
  const othersPhotos = await prisma.photo.count({
    where: { albumId, isRemoved: false, userId: { not: a.user.id } },
  });
  if (othersPhotos > 0) {
    return NextResponse.json({ error: "Ese álbum tiene fotos de otros fotógrafos: elegí un álbum que sea sólo tuyo." }, { status: 409 });
  }
  await prisma.agencyAlbum.create({ data: { agencyId: a.agency.id, albumId } });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const albumId = Number(req.nextUrl.searchParams.get("albumId"));
  if (!Number.isInteger(albumId) || albumId <= 0) return NextResponse.json({ error: "Álbum inválido." }, { status: 400 });
  const othersPhotos = await prisma.photo.count({
    where: { albumId, isRemoved: false, userId: { not: a.user.id } },
  });
  if (othersPhotos > 0) {
    return NextResponse.json({ error: "Este álbum tiene fotos de tu equipo: no se puede quitar de la agencia." }, { status: 409 });
  }
  const { count } = await prisma.agencyAlbum.deleteMany({ where: { agencyId: a.agency.id, albumId } });
  if (count === 0) return NextResponse.json({ error: "Ese álbum no es de la agencia." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
