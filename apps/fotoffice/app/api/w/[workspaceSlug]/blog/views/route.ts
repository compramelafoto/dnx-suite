import { NextResponse, type NextRequest } from "next/server";
import { countBlogView, getBlogPost, loadPublicBlog } from "@/lib/blog/public";
import {
  BLOG_VISITOR_COOKIE,
  BLOG_VISITOR_MAX_AGE,
  blogViewsCookiePath,
  resolveBlogVisitorKey,
} from "@/lib/blog/public-format";

/**
 * Registra la vista única de un artículo del blog de una institución.
 *
 * Es una ruta y no parte de la página porque hace falta escribir la cookie del visitante, y el
 * render de un Server Component sólo lee. Mismo camino que Clickatón
 * (`apps/clickaton/app/api/public/blog/views/route.ts`).
 *
 * Responde siempre 200 salvo un pedido mal formado: que una vista no se cuente nunca tiene que
 * mostrarle un error a quien está leyendo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 200) : "";
  if (!slug) return NextResponse.json({ ok: false, error: "SLUG_REQUIRED" }, { status: 400 });

  const { visitorKey, isNew } = resolveBlogVisitorKey(req.cookies.get(BLOG_VISITOR_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  if (isNew) {
    response.cookies.set(BLOG_VISITOR_COOKIE, visitorKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // Acotada al blog de ESTA institución: otra institución no ve ni comparte este visitante.
      path: blogViewsCookiePath(workspaceSlug),
      maxAge: BLOG_VISITOR_MAX_AGE,
    });
  }

  try {
    const blog = await loadPublicBlog(workspaceSlug);
    const post = blog ? await getBlogPost(blog, slug) : null;
    // `countBlogView` no espera la escritura (el motor la dispara y sigue): la respuesta no se
    // demora por contar, y si contar falla queda en el log del motor, no acá.
    if (blog && post) countBlogView(blog, post.id, visitorKey);
  } catch (err) {
    console.error("[fotoffice][blog] no se pudo registrar la vista:", err);
  }

  return response;
}
