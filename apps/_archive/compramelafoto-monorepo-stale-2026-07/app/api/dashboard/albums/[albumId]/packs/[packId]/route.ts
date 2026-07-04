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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string; packId: string }> },
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId: albumIdRaw, packId } = await params;
    const albumId = parseAlbumId(albumIdRaw);
    if (!albumId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const album = await prisma.album.findFirst({
      where: user.role === "ADMIN" ? { id: albumId } : { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });

    const existing = await prisma.albumPack.findFirst({
      where: { id: packId, albumId },
      select: {
        id: true,
        includedPhotoCount: true,
        requiresSelection: true,
        requiresDesign: true,
        templateId: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const updateData: {
      name?: string;
      description?: string | null;
      price?: number;
      includedPhotoCount?: number | null;
      requiresSelection?: boolean;
      requiresDesign?: boolean;
      templateId?: number | null;
      availabilityPhase?: AlbumPackAvailabilityPhase;
      packType?: AlbumPackType;
      isActive?: boolean;
    } = {};

    if (body?.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 });
      updateData.name = name;
    }
    if (body?.description !== undefined) {
      updateData.description = body.description != null ? String(body.description).trim() || null : null;
    }
    if (body?.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "price debe ser mayor o igual a 0" }, { status: 400 });
      }
      updateData.price = Math.trunc(price);
    }
    if (body?.includedPhotoCount !== undefined) {
      const includedPhotoCount =
        body.includedPhotoCount == null ? null : Number(body.includedPhotoCount);
      if (includedPhotoCount != null && (!Number.isFinite(includedPhotoCount) || includedPhotoCount < 0)) {
        return NextResponse.json({ error: "includedPhotoCount inválido" }, { status: 400 });
      }
      updateData.includedPhotoCount = includedPhotoCount == null ? null : Math.trunc(includedPhotoCount);
    }
    if (body?.requiresSelection !== undefined) updateData.requiresSelection = Boolean(body.requiresSelection);
    if (body?.requiresDesign !== undefined) updateData.requiresDesign = Boolean(body.requiresDesign);
    if (body?.availabilityPhase !== undefined) {
      const availabilityPhase = String(body.availabilityPhase ?? "").trim().toUpperCase();
      if (!ALLOWED_AVAILABILITY_PHASES.has(availabilityPhase as AlbumPackAvailabilityPhase)) {
        return NextResponse.json({ error: "availabilityPhase inválido" }, { status: 400 });
      }
      updateData.availabilityPhase = availabilityPhase as AlbumPackAvailabilityPhase;
    }
    if (body?.packType !== undefined) {
      const packType = String(body.packType ?? "").trim().toUpperCase();
      if (!ALLOWED_PACK_TYPES.has(packType as AlbumPackType)) {
        return NextResponse.json({ error: "packType inválido" }, { status: 400 });
      }
      updateData.packType = packType as AlbumPackType;
    }
    if (body?.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body?.templateId !== undefined) {
      const templateId = body.templateId == null ? null : Number(body.templateId);
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
      updateData.templateId = templateId;
    }

    const nextRequiresSelection = updateData.requiresSelection ?? existing.requiresSelection;
    const nextRequiresDesign = updateData.requiresDesign ?? existing.requiresDesign;
    const nextIncludedPhotoCount =
      body?.includedPhotoCount !== undefined ? (updateData.includedPhotoCount ?? null) : existing.includedPhotoCount;
    const nextTemplateId =
      body?.templateId !== undefined ? (updateData.templateId ?? null) : existing.templateId;

    if (
      nextRequiresSelection &&
      (nextIncludedPhotoCount == null || !Number.isFinite(nextIncludedPhotoCount) || nextIncludedPhotoCount <= 0)
    ) {
      return NextResponse.json(
        { error: "includedPhotoCount debe ser mayor a 0 cuando requiresSelection es true" },
        { status: 400 },
      );
    }
    if (nextRequiresDesign && !nextRequiresSelection) {
      return NextResponse.json(
        { error: "requiresSelection debe ser true cuando requiresDesign es true" },
        { status: 400 },
      );
    }
    if (nextRequiresDesign && nextTemplateId == null) {
      return NextResponse.json({ error: "templateId es requerido cuando requiresDesign es true" }, { status: 400 });
    }

    const pack = await prisma.albumPack.update({
      where: { id: packId },
      data: updateData,
    });

    return NextResponse.json({ pack });
  } catch (error) {
    console.error("album pack PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar pack" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string; packId: string }> },
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId: albumIdRaw, packId } = await params;
    const albumId = parseAlbumId(albumIdRaw);
    if (!albumId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const album = await prisma.album.findFirst({
      where: user.role === "ADMIN" ? { id: albumId } : { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });

    const existing = await prisma.albumPack.findFirst({
      where: { id: packId, albumId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });

    await prisma.albumPack.delete({ where: { id: packId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("album pack DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar pack" }, { status: 500 });
  }
}
