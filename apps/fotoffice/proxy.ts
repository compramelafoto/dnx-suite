import { NextResponse, type NextRequest } from "next/server";
import { institutionShortcutRedirect } from "@/lib/entrada/institution-shortcut";
import { hostWithoutPort } from "@/lib/website/domain/normalize";
import { decideCustomDomainRoute, isFotofficeHost } from "@/lib/website/domain/routing";
import { lookupCustomDomainSlug } from "@/lib/website/domain/proxy-lookup";
import { rutaInternaInsertada } from "@/lib/service-leads/insertar";

// Next 16 renombró `middleware.ts` a `proxy.ts`. No carga Prisma: para resolver un dominio
// propio le pregunta a `/api/dominio-propio` (ver `lib/website/domain/proxy-lookup.ts`).

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

const FOTOFFICE_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/+$/, "");

export async function proxy(req: NextRequest) {
  const host = hostWithoutPort(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "");

  if (!isFotofficeHost(host, FOTOFFICE_ORIGIN)) {
    const custom = await handleCustomDomain(req, host);
    if (custom) return custom;
  }

  // Un formulario de consulta para insertar en otra web (`/w/<slug>/insertar[/<formulario>]`):
  // se dibuja en una ruta sin el encabezado ni el pie del sitio. Ver lib/service-leads/insertar.ts.
  const insertado = rutaInternaInsertada(req.nextUrl.pathname);
  if (insertado) return NextResponse.rewrite(new URL(`${insertado}${req.nextUrl.search}`, req.url));

  return protectPanel(req);
}

/**
 * Dominio propio de una institución (`sfpr.com.ar`): muestra su sitio con direcciones limpias.
 * Devuelve null si el dominio no es de nadie — la visita sigue como cualquier otra.
 * Spec: docs/superpowers/specs/2026-10-02-sitio-web-dominio-propio-design.md
 */
async function handleCustomDomain(req: NextRequest, host: string): Promise<NextResponse | null> {
  const { pathname, search } = req.nextUrl;

  // A la API se le pregunta por el dominio de FOTOFFICE si está configurado; si no, por el
  // mismo dominio de la visita (la ruta `/api/*` pasa sin tocar por acá).
  const apiOrigin = FOTOFFICE_ORIGIN || req.nextUrl.origin;

  if (host.startsWith("www.")) {
    const apex = host.slice(4);
    if (await lookupCustomDomainSlug(apex, apiOrigin)) {
      return NextResponse.redirect(`https://${apex}${pathname}${search}`, 308);
    }
    return null;
  }

  const slug = await lookupCustomDomainSlug(host, apiOrigin);
  if (!slug) return null;

  const decision = decideCustomDomainRoute({ pathname, search, slug, fotofficeOrigin: FOTOFFICE_ORIGIN });
  switch (decision.kind) {
    case "pass":
      return NextResponse.next();
    case "rewrite":
      return NextResponse.rewrite(new URL(`${decision.pathname}${search}`, req.url));
    case "redirect":
      return NextResponse.redirect(new URL(decision.url, req.url), 308);
  }
}

function protectPanel(req: NextRequest) {
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
  /*
    Todo menos los recursos estáticos de Next. Antes el matcher era una lista acotada (las
    rutas del panel y `/:institucion` para el atajo), para no correr en cada petición. Con los
    dominios propios eso ya no alcanza: `sfpr.com.ar/blog/mi-articulo` puede pedir cualquier
    dirección. En el dominio de FOTOFFICE el costo es mínimo: sólo comparaciones de texto, sin
    consultar nada, y el atajo y la protección se comportan igual que antes.
  */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
