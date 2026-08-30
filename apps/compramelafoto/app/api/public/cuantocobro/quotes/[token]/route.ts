import { NextResponse } from "next/server";
import { buildQuotePublicViewPayload } from "@/lib/cuantocobro/quote/quote-public-view";
import { recordQuotePublicView } from "@/lib/cuantocobro/quote/quote-delivery-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

function resolveClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** GET /api/public/cuantocobro/quotes/[token] — vista pública y tracking de apertura. */
export async function GET(request: Request, ctx: RouteContext) {
  const { token } = await ctx.params;
  const view = await recordQuotePublicView(token, {
    userAgent: request.headers.get("user-agent") ?? "",
    ip: resolveClientIp(request),
  });

  if (!view) {
    return NextResponse.json({ error: "Enlace no válido o expirado" }, { status: 404 });
  }

  return NextResponse.json({ view: buildQuotePublicViewPayload(view) });
}
