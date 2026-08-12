import { NextResponse } from "next/server";
import { getFotorankPartnersService } from "../../lib/fotorank/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ trackingKey: string }> };

/**
 * Redirect canónico DNX Partners (FotoRank).
 */
export async function GET(request: Request, { params }: Params) {
  const { trackingKey } = await params;
  if (!trackingKey?.trim()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const svc = getFotorankPartnersService();
  const ua = request.headers.get("user-agent");
  const referrer = request.headers.get("referer");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const clientSeed = forwarded || request.headers.get("x-real-ip") || "anon";

  const result = await svc.resolveOutboundRedirect({
    trackingKey: trackingKey.trim(),
    userAgent: ua,
    referrer,
    clientSeed,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason.toLowerCase() }, { status: 404 });
  }

  return NextResponse.redirect(result.redirectUrl, 302);
}
