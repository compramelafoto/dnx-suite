import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentCategoryCreate } from "@repo/content";
import { prisma } from "@/lib/admin/db";
import { listClickatonCategories } from "@/lib/content/admin-queries";
import { requireContentAdminApi } from "@/lib/content/admin-route-utils";
import { handleContentApiError } from "@/lib/content/content-errors";
import {
  CLICKATON_CONTENT_PLATFORM,
  stripClientPlatform,
} from "@/lib/content/content-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  try {
    return NextResponse.json({ categories: await listClickatonCategories() });
  } catch (err) {
    return handleContentApiError(err, "las categorías");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentCategoryCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const category = await prisma.blogCategory.create({
      data: { ...parsed.data, platform: CLICKATON_CONTENT_PLATFORM },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return handleContentApiError(err, "la categoría");
  }
}
