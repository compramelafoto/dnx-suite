import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleBlogPrismaError,
  requireBlogAdmin,
} from "@/lib/blog/admin-route-utils";
import { uploadBlogImage } from "@/lib/blog/blog-image-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimOptional(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function GET(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);

  const where =
    q.length > 0
      ? {
          OR: [
            { filename: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { altText: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

  const media = await prisma.blogMedia.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ media });
}

export async function POST(req: NextRequest) {
  const auth = await requireBlogAdmin();
  if (auth.response) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    const uploaded = await uploadBlogImage(file, "blog/media");
    const title = trimOptional(formData.get("title"), 200);
    const altText = trimOptional(formData.get("altText"), 500);
    const caption = trimOptional(formData.get("caption"), 1000);

    const media = await prisma.blogMedia.create({
      data: {
        filename: uploaded.filename,
        url: uploaded.url,
        r2Key: uploaded.r2Key,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        title,
        altText,
        caption,
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error subiendo imagen";
    const status = message.includes("permiten") || message.includes("superar") ? 400 : 500;
    if (status === 500) {
      console.error("POST /api/admin/blog/media", err);
      return handleBlogPrismaError(err, "la imagen");
    }
    return NextResponse.json({ error: message }, { status });
  }
}
