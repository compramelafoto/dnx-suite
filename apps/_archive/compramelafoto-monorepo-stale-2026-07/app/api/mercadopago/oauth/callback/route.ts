import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/mercadopago-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Callback de Mercado Pago OAuth
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
    const buildRedirect = (ownerType?: string, params?: Record<string, string>) => {
      const path = ownerType === "LAB" ? "/lab/configuracion" : "/fotografo/configuracion";
      const url = new URL(path, baseUrl);
      if (params) {
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      }
      return url.toString();
    };

    if (error) {
      return NextResponse.redirect(buildRedirect(undefined, { mp_error: error }));
    }

    if (!state) {
      return NextResponse.redirect(buildRedirect(undefined, { mp_error: "missing_state" }));
    }

    const stateRecord = await prisma.mercadoPagoOAuthState.findUnique({
      where: { state },
    });

    if (!stateRecord) {
      return NextResponse.redirect(buildRedirect(undefined, { mp_error: "invalid_state" }));
    }

    if (stateRecord.usedAt) {
      return NextResponse.redirect(buildRedirect(stateRecord.ownerType, { mp_error: "state_used" }));
    }

    if (stateRecord.expiresAt.getTime() < Date.now()) {
      return NextResponse.redirect(buildRedirect(stateRecord.ownerType, { mp_error: "state_expired" }));
    }

    if (!code) {
      return NextResponse.redirect(buildRedirect(stateRecord.ownerType, { mp_error: "missing_code" }));
    }

    const tokenData = await exchangeCodeForToken(code);
    const { access_token, refresh_token, user_id } = tokenData;
    const mpUserId = user_id !== undefined && user_id !== null ? String(user_id) : null;

    if (!access_token) {
      return NextResponse.redirect(buildRedirect(stateRecord.ownerType, { mp_error: "no_token" }));
    }

    if (stateRecord.ownerType === "USER") {
      await prisma.user.update({
        where: { id: stateRecord.ownerId },
        data: {
          mpAccessToken: access_token,
          mpRefreshToken: refresh_token || null,
          mpUserId,
          mpConnectedAt: new Date(),
        },
      });
    } else {
      await prisma.lab.update({
        where: { id: stateRecord.ownerId },
        data: {
          mpAccessToken: access_token,
          mpRefreshToken: refresh_token || null,
          mpUserId,
          mpConnectedAt: new Date(),
        },
      });
    }

    await prisma.mercadoPagoOAuthState.update({
      where: { id: stateRecord.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.redirect(buildRedirect(stateRecord.ownerType, { mp_connected: "true" }));
  } catch (err: any) {
    console.error("GET /api/mercadopago/oauth/callback ERROR >>>", err);
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
    const url = new URL("/fotografo/configuracion", baseUrl);
    url.searchParams.set("mp_error", err?.message || "unknown_error");
    return NextResponse.redirect(url.toString());
  }
}
