import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OAuthError, exchangeCode, verifyState } from "@/lib/finance-dnx/mail/google-oauth";
import { googleClient, mailRedirectUri } from "@/lib/finance-dnx/mail/prisma-ports";
import { sealRefreshToken, vaultKeyFromEnv } from "@/lib/finance-dnx/mail/token-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function volver(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/finanzas-dnx/gastos", req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return volver(req, { gmail: "cancelado" });
  try {
    const key = vaultKeyFromEnv();
    if (!verifyState(sp.get("state") ?? "", Date.now(), key)) return volver(req, { gmail: "vencido" });
    const { clientId, clientSecret } = googleClient();
    const { refreshToken, email } = await exchangeCode({
      code: sp.get("code") ?? "",
      clientId,
      clientSecret,
      redirectUri: mailRedirectUri(req.nextUrl.origin),
    });
    const refreshTokenEnc = sealRefreshToken(refreshToken, key);
    await prisma.expenseMailAccount.upsert({
      where: { email },
      create: { email, refreshTokenEnc },
      update: { refreshTokenEnc, connectedAt: new Date(), lastError: null, lastErrorAlertedAt: null },
    });
    return volver(req, { gmail: "conectada", cuenta: email });
  } catch (err) {
    console.error("GET /api/admin/finance-dnx/mail/callback ERROR >>>", err);
    const detalle = err instanceof OAuthError ? err.message : "No se pudo conectar la cuenta.";
    return volver(req, { gmail: "error", detalle });
  }
}
