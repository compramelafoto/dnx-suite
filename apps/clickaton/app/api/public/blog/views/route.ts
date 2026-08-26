/**
 * Registro de vista única de una nota del blog.
 *
 * Vive en una route handler (no en el server component) porque hace falta
 * escribir la cookie de visitante; el render de páginas es solo lectura.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  CLICKATON_BLOG_VISITOR_COOKIE,
  CLICKATON_BLOG_VISITOR_MAX_AGE,
  resolveClickatonBlogVisitorKey,
} from "@/lib/content/visitor";
import {
  getClickatonPostBySlug,
  incrementClickatonPostViews,
} from "@/lib/content/public-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 200) : "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "SLUG_REQUIRED" }, { status: 400 });
  }

  const { visitorKey, isNew } = resolveClickatonBlogVisitorKey(
    req.cookies.get(CLICKATON_BLOG_VISITOR_COOKIE)?.value,
  );

  const response = NextResponse.json({ ok: true });
  if (isNew) {
    response.cookies.set(CLICKATON_BLOG_VISITOR_COOKIE, visitorKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CLICKATON_BLOG_VISITOR_MAX_AGE,
    });
  }

  try {
    const post = await getClickatonPostBySlug(slug);
    if (post) {
      incrementClickatonPostViews(post.id, visitorKey);
    }
  } catch (err) {
    console.error("[clickaton][content] view increment failed:", err);
  }

  return response;
}
