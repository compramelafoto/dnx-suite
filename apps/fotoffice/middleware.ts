import { NextResponse, type NextRequest } from "next/server";
import { institutionShortcutRedirect } from "@/lib/entrada/institution-shortcut";

const DNX_SESSION_COOKIE = "dnx_session";

const PROTECTED_PREFIXES = [
  "/workspace",
  "/onboarding",
  "/bienvenida",
  "/dashboard",
  "/courses",
  "/evaluaciones",
  "/members",
  "/website",
  "/admin",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /*
    Atajo a la dirección pública de una institución: `/sfpr` → `/w/sfpr`.

    Va primero porque es un redirect y no tiene nada que ver con la sesión: `/sfpr` es
    público, igual que `/w/sfpr`. Los nombres reservados devuelven `null` y siguen de largo,
    así que ninguna pantalla de la aplicación puede quedar tapada por una institución.
  */
  const atajo = institutionShortcutRedirect(pathname);
  if (atajo) return NextResponse.redirect(new URL(atajo, req.url));

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
    "/bienvenida",
    "/dashboard/:path*",
    "/courses/:path*",
    "/evaluaciones/:path*",
    "/members/:path*",
    "/website/:path*",
    "/admin/:path*",
    /*
      Una sola sección: es el atajo `/sfpr`. Deliberadamente acotado en vez de "todo menos
      _next y api" — el middleware corre en cada petición que caiga en el matcher, y no hay
      motivo para hacerlo correr en `/w/sfpr/cursos/foto-basica`.

      Esto hace que el middleware también corra en `/login` y demás pantallas de un nivel:
      ahí `institutionShortcutRedirect` devuelve `null` por reservadas y sigue de largo.
    */
    "/:institucion",
  ],
};
