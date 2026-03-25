import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/admin/template-image/upload
 * Sube imagen para plantilla pública del sistema (sin álbum). Solo admin.
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.arrayBuffer) {
      return NextResponse.json({ error: "Falta el archivo (file)" }, { status: 400 });
    }

    const contentType = (file.type || "image/png").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá PNG, JPG o WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen no puede superar 10 MB." },
        { status: 400 }
      );
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const name = `plantilla_system_${randomUUID()}.${ext}`;
    const key = generateR2Key(name, "template-images/system");

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(buffer, key, contentType);
    const imageUrl = getR2PublicUrl(key);

    return NextResponse.json({ imageUrl });
  } catch (e) {
    console.error("admin template-image upload error:", e);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
