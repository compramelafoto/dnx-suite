import { NextResponse } from "next/server";
import {
  FOTORANK_GOOGLE_OAUTH_STATE,
  resolveBaseUrl,
  resolveGoogleRedirectUri,
} from "../../../lib/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const baseUrl = resolveBaseUrl(origin);
    const redirectUri = resolveGoogleRedirectUri(baseUrl);

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.json({ error: "GOOGLE_CLIENT_ID no está configurado" }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state: FOTORANK_GOOGLE_OAUTH_STATE,
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err: unknown) {
    console.error("FOTORANK GOOGLE AUTH ERROR", err);
    return NextResponse.json(
      {
        error: "Error iniciando autenticación con Google",
        detail: String(err instanceof Error ? err.message : err),
      },
      { status: 500 },
    );
  }
}
