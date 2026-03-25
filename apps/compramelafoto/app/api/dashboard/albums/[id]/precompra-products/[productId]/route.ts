import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/dashboard/albums/[id]/precompra-products/[productId]
 * Actualizar producto. Body: name?, description?, price?, mockupUrl?, minFotos?, maxFotos?, requiresDesign?, suggestionText?
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; productId: string } | Promise<{ id: string; productId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, productId } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    const productIdNum = parseInt(productId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(productIdNum)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const existing = await prisma.albumProduct.findFirst({
      where: { id: productIdNum, albumId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: { name?: string; description?: string | null; price?: number; mockupUrl?: string | null; minFotos?: number; maxFotos?: number; requiresDesign?: boolean; suggestionText?: string | null } = {};

    if (body?.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 });
      updateData.name = name;
    }
    if (body?.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body?.price !== undefined) updateData.price = Math.max(0, Number(body.price) || 0);
    if (body?.mockupUrl !== undefined) updateData.mockupUrl = body.mockupUrl?.trim() || null;
    if (body?.minFotos !== undefined) updateData.minFotos = Math.max(0, Math.min(100, Number(body.minFotos) ?? 1));
    if (body?.maxFotos !== undefined) updateData.maxFotos = Math.max(1, Math.min(100, Number(body.maxFotos) ?? 1));
    if (body?.requiresDesign !== undefined) updateData.requiresDesign = Boolean(body.requiresDesign);
    if (body?.suggestionText !== undefined) updateData.suggestionText = body.suggestionText?.trim() || null;

    const product = await prisma.albumProduct.update({
      where: { id: productIdNum },
      data: updateData,
    });

    return NextResponse.json({ product });
  } catch (e) {
    console.error("precompra-products PATCH error:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

/**
 * DELETE /api/dashboard/albums/[id]/precompra-products/[productId]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; productId: string } | Promise<{ id: string; productId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, productId } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    const productIdNum = parseInt(productId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(productIdNum)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const existing = await prisma.albumProduct.findFirst({
      where: { id: productIdNum, albumId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    await prisma.albumProduct.delete({ where: { id: productIdNum } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("precompra-products DELETE error:", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
