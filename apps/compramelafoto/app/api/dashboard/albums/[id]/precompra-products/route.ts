import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/precompra-products
 * Listar productos de pre-venta del álbum.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const products = await prisma.albumProduct.findMany({
      where: { albumId },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ products });
  } catch (e) {
    console.error("precompra-products GET error:", e);
    return NextResponse.json({ error: "Error al listar" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/albums/[id]/precompra-products
 * Crear producto de pre-venta. Body: name, description?, price, mockupUrl?, minFotos, maxFotos, requiresDesign?, suggestionText?
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }

    const product = await prisma.albumProduct.create({
      data: {
        albumId,
        name,
        description: body?.description?.trim() || null,
        price: Math.max(0, Number(body?.price) || 0),
        mockupUrl: body?.mockupUrl?.trim() || null,
        minFotos: Math.max(0, Math.min(100, Number(body?.minFotos) ?? 1)),
        maxFotos: Math.max(1, Math.min(100, Number(body?.maxFotos) ?? 1)),
        requiresDesign: Boolean(body?.requiresDesign),
        suggestionText: body?.suggestionText?.trim() || null,
      },
    });

    return NextResponse.json({ product });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al crear";
    console.error("precompra-products POST error:", e);
    return NextResponse.json(
      { error: "Error al crear", detail: message },
      { status: 500 }
    );
  }
}
