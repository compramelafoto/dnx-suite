import { NextRequest, NextResponse } from "next/server";
import {
  formatContentValidationError,
  parseContentPostCreate,
  parseContentPostStatusFilter,
  parseContentPostTypeFilter,
} from "@repo/content";
import { handleContentApiError } from "@/lib/content/content-errors";
import { listClickatonAdminPosts } from "@/lib/content/admin-queries";
import { stripClientPlatform } from "@/lib/content/content-platform";
import { createClickatonPost, mapContentPostResponse } from "@/lib/content/post-persistence";
import { requireContentAdminApi } from "@/lib/content/admin-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  try {
    const posts = await listClickatonAdminPosts({
      status: parseContentPostStatusFilter(searchParams.get("status")),
      type: parseContentPostTypeFilter(searchParams.get("type")),
      q: searchParams.get("q"),
    });
    return NextResponse.json({ posts });
  } catch (err) {
    return handleContentApiError(err, "las notas");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentPostCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const post = await createClickatonPost(parsed.data);
    return NextResponse.json({ post: mapContentPostResponse(post) }, { status: 201 });
  } catch (err) {
    return handleContentApiError(err, "la nota");
  }
}
