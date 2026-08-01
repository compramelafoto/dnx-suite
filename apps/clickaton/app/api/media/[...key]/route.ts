/**
 * Proxy público de media para namespaces de marketing (editions / products).
 * Sin R2_PUBLIC_URL el bucket no es público; estas rutas sirven los bytes vía R2 S3.
 * No expone `clickaton/private/` ni welcome/profile (tienen proxies autenticados).
 */
import { NextResponse } from "next/server";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_KEY =
  /^clickaton\/(editions|products)\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+$/i;

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  const segments = (await params).key ?? [];
  const key = segments.map((s) => decodeURIComponent(s)).join("/");
  if (!PUBLIC_KEY.test(key) || key.includes("..")) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const body = await getWelcomeCardStorage().get(key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
}
