import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { BLOG_DEFAULT_COVER_IMAGE_PATH } from "@/lib/blog/blog-default-cover";
import { resolveBlogPostThumbnailUrl } from "@/lib/blog/blog-post-images";
import { getPublishedPostBySlug } from "@/lib/blog/public-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Caché corta: la portada puede cambiar; ?v= en la URL invalida previews en redes. */
const CACHE_CONTROL = "public, max-age=120, s-maxage=300, stale-while-revalidate=600";

async function defaultCoverResponse(): Promise<NextResponse> {
  try {
    const relativePath = BLOG_DEFAULT_COVER_IMAGE_PATH.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", relativePath);
    const body = await readFile(filePath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error("GET /api/blog/og-image default cover fallback", error);
    return new NextResponse(null, { status: 404 });
  }
}

function isLocalPublicAssetUrl(sourceUrl: string): boolean {
  return sourceUrl.startsWith("/") && !sourceUrl.startsWith("//");
}

async function localPublicAssetResponse(sourceUrl: string): Promise<NextResponse | null> {
  if (!isLocalPublicAssetUrl(sourceUrl)) return null;
  try {
    const relativePath = sourceUrl.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", relativePath);
    const body = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    return null;
  }
}

/** Proxy público de la imagen OG del artículo (mismo dominio; fallback si la portada no es HTTPS absoluta). */
export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) {
    return await defaultCoverResponse();
  }

  const sourceUrl = resolveBlogPostThumbnailUrl(post);
  const localAsset = await localPublicAssetResponse(sourceUrl);
  if (localAsset) {
    return localAsset;
  }

  try {
    const upstream = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        Accept: "image/*",
      },
    });
    if (!upstream.ok) {
      console.warn("GET /api/blog/og-image upstream not ok", {
        slug,
        status: upstream.status,
        sourceUrl: sourceUrl.slice(0, 120),
      });
      return await defaultCoverResponse();
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();
    const etag = upstream.headers.get("etag");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": CACHE_CONTROL,
    };
    if (etag) headers.ETag = etag;

    const url = new URL(req.url);
    if (url.searchParams.has("v")) {
      headers.Vary = "Accept";
    }

    return new NextResponse(body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("GET /api/blog/og-image/[slug]", slug, error);
    return await defaultCoverResponse();
  }
}
