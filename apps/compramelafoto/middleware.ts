import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REFERRAL_COOKIE_NAME = "clf_ref";
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 días en segundos

/**
 * Legacy: rutas bajo `/f/[handler]/...` → canónica `/[handler]/...` (301).
 * Evita 404 en enlaces viejos; el destino resuelve 404 si el slug no existe (igual que sin `/f`).
 */
function legacyPhotographerPrefixRedirect(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/f" || pathname === "/f/") {
    return null;
  }
  const m = pathname.match(/^\/f\/([^/]+)(\/.*)?$/);
  if (!m) {
    return null;
  }
  const handler = m[1]!.toLowerCase();
  const rest = m[2] ?? "";
  const url = new URL(request.url);
  url.pathname = `/${handler}${rest}`;
  return NextResponse.redirect(url, 301);
}

export function middleware(request: NextRequest) {
  const legacy = legacyPhotographerPrefixRedirect(request);
  if (legacy) {
    return legacy;
  }

  if (request.nextUrl.pathname === "/") {
    const userParam = request.nextUrl.searchParams.get("user");
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData?.role === "ORGANIZER") {
          return NextResponse.next();
        }
      } catch {}
    }
    return NextResponse.next();
  }

  const ref = request.nextUrl.searchParams.get("ref");
  const refTrimmed = typeof ref === "string" ? ref.trim() : "";

  const response = NextResponse.next();

  if (refTrimmed) {
    const isProd = process.env.NODE_ENV === "production";
    const cookieValue =
      encodeURIComponent(REFERRAL_COOKIE_NAME) +
      "=" +
      encodeURIComponent(refTrimmed) +
      "; Path=/; Max-Age=" +
      REFERRAL_COOKIE_MAX_AGE +
      "; SameSite=Lax" +
      (isProd ? "; Secure" : "");

    response.headers.append("Set-Cookie", cookieValue);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Excluir: /api, /_next, favicon, imágenes y otros estáticos.
     * Aplicar a rutas de página (/, /registro, etc.).
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|css|js)$).*)",
  ],
};
