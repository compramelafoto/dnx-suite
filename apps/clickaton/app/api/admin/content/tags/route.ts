import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentTagCreate } from "@repo/content";
import { prisma } from "@/lib/admin/db";
import { listClickatonTags } from "@/lib/content/admin-queries";
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
    return NextResponse.json({ tags: await listClickatonTags() });
  } catch (err) {
    return handleContentApiError(err, "los tags");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentTagCreate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const tag = await prisma.blogTag.create({
      data: { ...parsed.data, platform: CLICKATON_CONTENT_PLATFORM },
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (err) {
    return handleContentApiError(err, "el tag");
  }
}
