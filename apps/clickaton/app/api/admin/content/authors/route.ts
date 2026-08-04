import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentAuthorCreate } from "@repo/content";
import { prisma } from "@/lib/admin/db";
import { listClickatonAuthors } from "@/lib/content/admin-queries";
import { requireContentAdminApi } from "@/lib/content/admin-route-utils";
import { handleContentApiError } from "@/lib/content/content-errors";
import {
  CLICKATON_CONTENT_PLATFORM,
  stripClientPlatform,
} from "@/lib/content/content-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  try {
    return NextResponse.json({ authors: await listClickatonAuthors({ activeOnly }) });
  } catch (err) {
    return handleContentApiError(err, "los autores");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentAuthorCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const author = await prisma.blogAuthor.create({
      data: { ...parsed.data, platform: CLICKATON_CONTENT_PLATFORM },
    });
    return NextResponse.json({ author }, { status: 201 });
  } catch (err) {
    return handleContentApiError(err, "el autor");
  }
}
