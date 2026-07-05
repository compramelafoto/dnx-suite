import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function getExtension(contentType: string, filename: string): string {
  const ext = filename?.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]?.slice(1);
  if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return ext;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * POST /api/fotografo/schools/upload-logo
 * FormData: file. Sube a R2 bajo school-logos/{userId}/ y devuelve logoUrl para crear/actualizar escuela.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.arrayBuffer) {
      return NextResponse.json({ error: "Falta el archivo (file)" }, { status: 400 });
    }

    const contentType = (file.type || "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá JPG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen no puede superar 5 MB." }, { status: 400 });
    }

    const ext = getExtension(contentType, file.name);
    const name = `logo_${randomUUID()}.${ext}`;
    const key = generateR2Key(name, `school-logos/${user.id}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(buffer, key, contentType, {
      type: "school_logo",
      userId: String(user.id),
    });

    const logoUrl = getR2PublicUrl(key);
    return NextResponse.json({ logoUrl });
  } catch (e) {
    console.error("school upload-logo error:", e);
    return NextResponse.json({ error: "Error al subir el logo" }, { status: 500 });
  }
}
