import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { InstagramConnectionConfigError, runSocialTokenRefresh } from "@/lib/social/connect-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron autenticado: renueva el token de Instagram de CompraMeLaFoto antes de que venza
 * (margen de 10 días — ver `decideTokenRefresh`). Corre una vez por día, igual que
 * `social-publish`.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const summary = await runSocialTokenRefresh();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message =
      error instanceof InstagramConnectionConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error desconocido";
    console.error(`[cron social-token-refresh] ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
