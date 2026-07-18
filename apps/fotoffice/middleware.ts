import { NextResponse, type NextRequest } from "next/server";

const DNX_SESSION_COOKIE = "dnx_session";

const PROTECTED_PREFIXES = ["/workspace", "/onboarding", "/dashboard", "/courses", "/evaluaciones", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get(DNX_SESSION_COOKIE)?.value;
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/workspace/:path*",
    "/onboarding",
    "/dashboard/:path*",
    "/courses/:path*",
    "/evaluaciones/:path*",
    "/admin/:path*",
  ],
};
