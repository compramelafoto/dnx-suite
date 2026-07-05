import { NextRequest, NextResponse } from "next/server";
import {
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { uploadBlogImage } from "@/lib/blog/blog-image-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — sube imagen destacada (hero) del artículo. */
export async function POST(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    const uploaded = await uploadBlogImage(file, "blog/hero");
    return NextResponse.json({
      url: uploaded.url,
      heroImageUrl: uploaded.url,
      r2Key: uploaded.r2Key,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error subiendo imagen";
    const status = message.includes("permiten") || message.includes("superar") ? 400 : 500;
    if (status === 500) {
      console.error("POST /api/admin/blog/upload", e);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
