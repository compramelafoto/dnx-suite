/**
 * Subida pública de logo para formularios de alta de comunidad (Para fotógrafos / Proveedores).
 * No requiere autenticación. Devuelve la URL del logo para enviarla en el submit.
 */

import { NextResponse } from "next/server";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo no puede superar 2 MB" },
        { status: 400 }
      );
    }

    const contentType = file.type?.toLowerCase() || "";
    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usá JPEG, PNG o WebP." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = generateR2Key(`community_logo_${Date.now()}_${file.name}`, "logos/community");

    const { url } = await uploadToR2(buffer, key, contentType, {
      type: "community_logo",
    });

    return NextResponse.json({ logoUrl: url }, { status: 200 });
  } catch (err: unknown) {
    console.error("POST /api/public/community-upload-logo ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo logo", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
