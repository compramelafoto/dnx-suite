import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { buildConsentUrl, signState } from "@/lib/finance-dnx/mail/google-oauth";
import { googleClient, mailRedirectUri } from "@/lib/finance-dnx/mail/prisma-ports";
import { vaultKeyFromEnv } from "@/lib/finance-dnx/mail/token-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  try {
    const { clientId } = googleClient();
    const url = buildConsentUrl({
      clientId,
      redirectUri: mailRedirectUri(req.nextUrl.origin),
      state: signState(Date.now(), vaultKeyFromEnv()),
    });
    return NextResponse.redirect(url);
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/mail/connect ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
