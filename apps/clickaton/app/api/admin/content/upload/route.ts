import { NextRequest, NextResponse } from "next/server";
import { requireContentAdminApi } from "@/lib/content/admin-route-utils";
import { uploadBlogImage } from "@/lib/content/blog-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — sube la imagen destacada (hero) de una nota del blog. */
export async function POST(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
  }

  try {
    const uploaded = await uploadBlogImage(file, "hero");
    return NextResponse.json({
      url: uploaded.url,
      heroImageUrl: uploaded.url,
      r2Key: uploaded.r2Key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error subiendo imagen";
    if (message === "CONTENT_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error: "Almacenamiento de medios no configurado en este entorno",
          code: "CONTENT_STORAGE_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    const isValidation =
      message.includes("permiten") || message.includes("superar") || message.includes("vacío");
    if (!isValidation) {
      console.error("[clickaton][content] POST /api/admin/content/upload:", err);
    }
    return NextResponse.json(
      { error: isValidation ? message : "No se pudo subir la imagen" },
      { status: isValidation ? 400 : 500 },
    );
  }
}
