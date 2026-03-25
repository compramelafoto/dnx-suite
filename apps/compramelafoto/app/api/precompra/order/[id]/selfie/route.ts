import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf(".") + 1);
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] || "image/jpeg";
}

/**
 * POST /api/precompra/order/[id]/selfie
 * Subir selfie para un subject. FormData: subjectId (number), file (image)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const formData = await req.formData();
    const subjectIdParam = formData.get("subjectId");
    const file = formData.get("file") as File | null;

    const subjectId = subjectIdParam != null ? parseInt(String(subjectIdParam), 10) : NaN;
    if (!Number.isInteger(subjectId) || subjectId <= 0 || !file?.arrayBuffer) {
      return NextResponse.json(
        { error: "subjectId y archivo (file) son requeridos" },
        { status: 400 }
      );
    }

    const order = await prisma.preCompraOrder.findUnique({
      where: { id: orderId },
      include: { subjects: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (!order.subjects.some((s) => s.id === subjectId)) {
      return NextResponse.json({ error: "El niño no pertenece a este pedido" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = (file as any).name || "selfie.jpg";
    const contentType = getContentType(name);
    const key = generateR2Key(name, "precompra/selfies");

    await uploadToR2(buffer, key, contentType);
    const imageUrl = getR2PublicUrl(key);

    const selfie = await prisma.subjectSelfie.create({
      data: {
        subjectId,
        orderId,
        imageUrl,
      },
    });

    return NextResponse.json({ selfie });
  } catch (e) {
    console.error("precompra selfie upload error:", e);
    return NextResponse.json({ error: "Error al subir la selfie" }, { status: 500 });
  }
}
