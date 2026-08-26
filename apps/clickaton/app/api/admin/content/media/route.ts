import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";
import { listClickatonMedia } from "@/lib/content/admin-queries";
import {
  parseListLimit,
  requireContentAdminApi,
  trimOptionalFormValue,
} from "@/lib/content/admin-route-utils";
import { uploadBlogImage } from "@/lib/content/blog-storage";
import { handleContentApiError } from "@/lib/content/content-errors";
import { CLICKATON_CONTENT_PLATFORM } from "@/lib/content/content-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  try {
    const media = await listClickatonMedia({
      q: searchParams.get("q") ?? undefined,
      limit: parseListLimit(searchParams.get("limit"), 50),
    });
    return NextResponse.json({ media });
  } catch (err) {
    return handleContentApiError(err, "la biblioteca");
  }
}

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

  let uploaded: Awaited<ReturnType<typeof uploadBlogImage>>;
  try {
    uploaded = await uploadBlogImage(file, "media");
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
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const media = await prisma.blogMedia.create({
      data: {
        platform: CLICKATON_CONTENT_PLATFORM,
        filename: uploaded.filename,
        url: uploaded.url,
        r2Key: uploaded.r2Key,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        title: trimOptionalFormValue(formData.get("title"), 200),
        altText: trimOptionalFormValue(formData.get("altText"), 500),
        caption: trimOptionalFormValue(formData.get("caption"), 1000),
      },
    });
    return NextResponse.json({ media }, { status: 201 });
  } catch (err) {
    return handleContentApiError(err, "la imagen");
  }
}
