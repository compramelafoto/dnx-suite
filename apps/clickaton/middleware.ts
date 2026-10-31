import { NextResponse, type NextRequest } from "next/server";
import {
  SUITE_REFERRAL_COOKIE,
  buildSuiteReferralSetCookie,
  suiteReferralCodeToStore,
} from "@repo/auth/suite-referral";

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * - Panel: propaga el pathname a Server Components para returnTo seguro.
 * - Cualquier página con `?dnx_ref=`: guarda la cookie del referido de DNX Suite
 *   (el primer link gana) para avisarle a ComprameLaFoto cuando la persona cree
 *   su cuenta.
 */
export function middleware(request: NextRequest) {
  let response: NextResponse;
  if (isAdminPath(request.nextUrl.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-clickaton-pathname", request.nextUrl.pathname);
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  } else {
    response = NextResponse.next();
  }

  const suiteReferralCode = suiteReferralCodeToStore(
    request.nextUrl,
    request.cookies.get(SUITE_REFERRAL_COOKIE)?.value,
  );
  if (suiteReferralCode) {
    response.headers.append(
      "Set-Cookie",
      buildSuiteReferralSetCookie(suiteReferralCode, request.nextUrl.protocol === "https:"),
    );
  }
  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    // Sólo corre en el resto del sitio cuando el link trae `?dnx_ref=`.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      has: [{ type: "query", key: "dnx_ref" }],
    },
  ],
};
