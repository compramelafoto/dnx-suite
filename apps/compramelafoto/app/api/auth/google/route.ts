import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicia el flujo OAuth con Google
 * Redirige al usuario a Google para autenticarse
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "PHOTOGRAPHER"; // Por defecto fotógrafo
    const redirectAfter = searchParams.get("redirect");
    const origin = new URL(req.url).origin;
    const baseUrl = origin || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = searchParams.get("redirect_uri") || `${baseUrl}/api/auth/google/callback?role=${role}`;

    let state = role;
    if (redirectAfter?.startsWith("/") && !redirectAfter.startsWith("//")) {
      state = `CC:${redirectAfter}`;
    }

    // Credenciales de Google OAuth (necesitas crearlas en Google Cloud Console)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      return NextResponse.json(
        { error: "GOOGLE_CLIENT_ID no está configurado" },
        { status: 500 }
      );
    }

    // Parámetros para la autorización de Google (incluir role en state para recuperarlo después)
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${baseUrl}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state, // Rol o retorno ¿Cuánto Cobro? (CC:/ruta)
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Redirigir al usuario a Google
    return NextResponse.redirect(googleAuthUrl);
  } catch (err: any) {
    console.error("GOOGLE AUTH ERROR >>>", err);
    return NextResponse.json(
      { error: "Error iniciando autenticación con Google", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
