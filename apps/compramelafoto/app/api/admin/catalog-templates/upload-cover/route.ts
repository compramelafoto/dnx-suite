import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { requireAdminCatalogTemplateApi } from "@/lib/catalog-templates/admin-api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/admin/catalog-templates/upload-cover
 * Sube portada para SystemCatalogTemplate. Devuelve URL y key para guardar en el formulario.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminCatalogTemplateApi();
  if (guard.error) return guard.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.arrayBuffer) {
      return NextResponse.json({ error: "Falta el archivo (file)." }, { status: 400 });
    }

    const contentType = (file.type || "image/png").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá PNG, JPG o WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen no puede superar 10 MB." }, { status: 400 });
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const name = `catalog_template_${randomUUID()}.${ext}`;
    const coverImageKey = generateR2Key(name, "catalog-templates");

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(buffer, coverImageKey, contentType);
    const coverImageUrl = getR2PublicUrl(coverImageKey);

    return NextResponse.json({ coverImageUrl, coverImageKey });
  } catch (e) {
    console.error("admin catalog-templates upload-cover:", e);
    return NextResponse.json({ error: "Error al subir la portada." }, { status: 500 });
  }
}
