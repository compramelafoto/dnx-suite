import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { getClickatonPartnersService } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ trackingKey: string }> };

/**
 * Redirect canónico DNX Partners (Clickatón).
 * Registra el click (si tracking activo) y redirige al destino HTTPS del partner.
 */
export async function GET(request: Request, { params }: Params) {
  const { trackingKey } = await params;
  if (!trackingKey?.trim()) {
    notFound();
  }

  const svc = getClickatonPartnersService();
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
    notFound();
  }

  return NextResponse.redirect(result.redirectUrl, 302);
}
