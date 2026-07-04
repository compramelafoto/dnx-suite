import { NextRequest, NextResponse } from "next/server";
import { AlbumPackAvailabilityPhase, AlbumPackType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_AVAILABILITY_PHASES = new Set<AlbumPackAvailabilityPhase>(
  Object.values(AlbumPackAvailabilityPhase),
);
const ALLOWED_PACK_TYPES = new Set<AlbumPackType>(Object.values(AlbumPackType));

function parseAlbumId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseAlbumId((await params).albumId);
    if (!albumId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const album = await prisma.album.findFirst({
      where: user.role === "ADMIN" ? { id: albumId } : { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });

    const packs = await prisma.albumPack.findMany({
      where: { albumId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ packs });
  } catch (error) {
    console.error("album packs GET error:", error);
    return NextResponse.json({ error: "Error al listar packs" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseAlbumId((await params).albumId);
    if (!albumId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const album = await prisma.album.findFirst({
      where: user.role === "ADMIN" ? { id: albumId } : { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const description = body?.description != null ? String(body.description).trim() : null;
    const rawPrice = body?.price;
    const price = rawPrice === undefined ? 0 : Number(rawPrice);
    const rawIncludedPhotoCount = body?.includedPhotoCount;
    const includedPhotoCount = rawIncludedPhotoCount == null ? null : Number(rawIncludedPhotoCount);
    const normalizedIncludedPhotoCount =
      includedPhotoCount == null ? null : Math.trunc(includedPhotoCount);
    const requiresSelection = Boolean(body?.requiresSelection);
    const requiresDesign = Boolean(body?.requiresDesign);
    const availabilityPhaseRaw = String(body?.availabilityPhase ?? "ALWAYS").trim().toUpperCase();
    const packTypeRaw = String(body?.packType ?? "DIGITAL").trim().toUpperCase();
    const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);
    const templateId = body?.templateId == null ? null : Number(body.templateId);

    if (!name) return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "price debe ser mayor o igual a 0" }, { status: 400 });
    }
    if (includedPhotoCount != null && (!Number.isFinite(includedPhotoCount) || includedPhotoCount < 0)) {
      return NextResponse.json({ error: "includedPhotoCount inválido" }, { status: 400 });
    }
    if (
      requiresSelection &&
      (normalizedIncludedPhotoCount == null ||
        !Number.isFinite(normalizedIncludedPhotoCount) ||
        normalizedIncludedPhotoCount <= 0)
    ) {
      return NextResponse.json(
        { error: "includedPhotoCount debe ser mayor a 0 cuando requiresSelection es true" },
        { status: 400 },
      );
    }
    if (requiresDesign && !requiresSelection) {
      return NextResponse.json(
        { error: "requiresSelection debe ser true cuando requiresDesign es true" },
        { status: 400 },
      );
    }
    if (requiresDesign && templateId == null) {
      return NextResponse.json({ error: "templateId es requerido cuando requiresDesign es true" }, { status: 400 });
    }

    if (!ALLOWED_AVAILABILITY_PHASES.has(availabilityPhaseRaw as AlbumPackAvailabilityPhase)) {
      return NextResponse.json({ error: "availabilityPhase inválido" }, { status: 400 });
    }
    if (!ALLOWED_PACK_TYPES.has(packTypeRaw as AlbumPackType)) {
      return NextResponse.json({ error: "packType inválido" }, { status: 400 });
    }
    const availabilityPhase = availabilityPhaseRaw as AlbumPackAvailabilityPhase;
    const packType = packTypeRaw as AlbumPackType;

    if (templateId != null && (!Number.isInteger(templateId) || templateId <= 0)) {
      return NextResponse.json({ error: "templateId inválido" }, { status: 400 });
    }

    if (templateId != null) {
      const template = await prisma.template.findFirst({
        where: { id: templateId, albumId },
        select: { id: true },
      });
      if (!template) {
        return NextResponse.json({ error: "templateId no pertenece a este álbum" }, { status: 400 });
      }
    }

    const pack = await prisma.albumPack.create({
      data: {
        albumId,
        name,
        description: description || null,
        price: Math.trunc(price),
        includedPhotoCount: normalizedIncludedPhotoCount,
        requiresSelection,
        requiresDesign,
        templateId,
        availabilityPhase,
        packType,
        isActive,
      },
    });

    return NextResponse.json({ pack }, { status: 201 });
  } catch (error) {
    console.error("album packs POST error:", error);
    return NextResponse.json({ error: "Error al crear pack" }, { status: 500 });
  }
}
