import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes JPG, PNG o WebP" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = generateR2Key(`banner_${file.name}`, "banner");
    const contentType = file.type || "image/jpeg";
    const { url } = await uploadToR2(buffer, key, contentType, {
      type: "home_banner",
    });

    return NextResponse.json({ url });
  } catch (e: any) {
    console.error("POST /api/admin/banner/upload", e);
    return NextResponse.json(
      { error: "Error subiendo imagen", detail: e?.message },
      { status: 500 }
    );
  }
}
