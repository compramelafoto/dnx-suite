import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/precompra-products/[productId]/templates
 * Lista plantillas del producto.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    const productId = parseInt((await params).productId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(productId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const product = await prisma.albumProduct.findFirst({
      where: { id: productId, albumId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const templates = await prisma.template.findMany({
      where: { albumProductId: productId },
      include: { slots: { orderBy: { index: "asc" } } },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("templates GET error:", e);
    return NextResponse.json({ error: "Error al listar plantillas" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/albums/[id]/precompra-products/[productId]/templates
 * Crea una plantilla. Body: { name, imageUrl, widthCm, heightCm, slots: [{ index, bbox: { x, y, width, height } }] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    const productId = parseInt((await params).productId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(productId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const product = await prisma.albumProduct.findFirst({
      where: { id: productId, albumId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? "").trim();
    const widthCm = Number(body?.widthCm);
    const heightCm = Number(body?.heightCm);
    const slots = Array.isArray(body?.slots) ? body.slots : [];
    const textElements = Array.isArray(body?.textElements) ? body.textElements : null;
    const pagesJson = Array.isArray(body?.pagesJson) ? body.pagesJson : null;

    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl es requerido" }, { status: 400 });
    }
    if (!Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(heightCm) || heightCm <= 0) {
      return NextResponse.json({ error: "widthCm y heightCm deben ser números positivos" }, { status: 400 });
    }

    const template = await prisma.template.create({
      data: {
        albumId,
        albumProductId: productId,
        name,
        imageUrl,
        widthCm,
        heightCm,
        textElementsJson: textElements as object | undefined,
        pagesJson: pagesJson as object[] | undefined,
        slots: {
          create: slots.map((s: { index?: number; bbox?: Record<string, number> }, i: number) => ({
            index: Number.isInteger(s.index) ? s.index : i,
            bbox: s.bbox && typeof s.bbox === "object" ? (s.bbox as object) : { x: 0, y: 0, width: 100, height: 100 },
          })),
        },
      },
      include: { slots: true },
    });

    return NextResponse.json({ template });
  } catch (e) {
    console.error("templates POST error:", e);
    return NextResponse.json({ error: "Error al crear plantilla" }, { status: 500 });
  }
}
