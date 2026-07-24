import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  registerClickByPublicToken,
  setAttributionCookie,
} from "@/lib/notifications/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /n/[token] — tracking seguro de clic + redirect a URL autorizada.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token } = await Promise.resolve(ctx.params);
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const user = await getAuthUser().catch(() => null);
  const result = await registerClickByPublicToken({
    publicToken: token.trim(),
    userId: user?.id ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await setAttributionCookie(result.deliveryId, result.campaignId);
  return NextResponse.redirect(result.redirectUrl, 302);
}
