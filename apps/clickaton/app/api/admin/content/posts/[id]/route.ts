import { NextRequest, NextResponse } from "next/server";
import { formatContentValidationError, parseContentPostUpdate } from "@repo/content";
import { getClickatonAdminPost } from "@/lib/content/admin-queries";
import { parseRouteId, requireContentAdminApi } from "@/lib/content/admin-route-utils";
import { handleContentApiError } from "@/lib/content/content-errors";
import { stripClientPlatform } from "@/lib/content/content-platform";
import {
  deleteClickatonPost,
  mapContentPostResponse,
  updateClickatonPost,
} from "@/lib/content/post-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const postId = parseRouteId((await params).id);
  if (!postId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const post = await getClickatonAdminPost(postId);
    if (!post) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (err) {
    return handleContentApiError(err, "la nota");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const postId = parseRouteId((await params).id);
  if (!postId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = stripClientPlatform(await req.json().catch(() => ({})));
  const parsed = parseContentPostUpdate(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: formatContentValidationError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const post = await updateClickatonPost(postId, parsed.data);
    if (!post) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    return NextResponse.json({ post: mapContentPostResponse(post) });
  } catch (err) {
    return handleContentApiError(err, "la nota");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireContentAdminApi();
  if (auth.response) return auth.response;

  const postId = parseRouteId((await params).id);
  if (!postId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const deleted = await deleteClickatonPost(postId);
    if (!deleted) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleContentApiError(err, "la nota");
  }
}
