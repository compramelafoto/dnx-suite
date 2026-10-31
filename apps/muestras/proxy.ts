import { NextResponse, type NextRequest } from "next/server";
import { isSalePublicId } from "@repo/muestras";
import {
  buildSuiteReferralSetCookie,
  SUITE_REFERRAL_COOKIE,
  suiteReferralCodeToStore,
} from "@repo/auth/suite-referral";
import { tokenConForma } from "@/lib/ventas/cookie-pedido";

/**
 * Referidos de DNX Suite: si la visita llega con `?dnx_ref=CODIGO` (y no tiene ya uno guardado:
 * el primer link gana), se guarda en la cookie `dnx_ref`. Se usa al crear la cuenta (callback de
 * Google) para avisarle a ComprameLaFoto quién la refirió.
 */
function conReferido(req: NextRequest, res: NextResponse): NextResponse {
  const codigo = suiteReferralCodeToStore(req.nextUrl, req.cookies.get(SUITE_REFERRAL_COOKIE)?.value);
  if (codigo) {
    res.headers.append("Set-Cookie", buildSuiteReferralSetCookie(codigo, req.nextUrl.protocol === "https:"));
  }
  return res;
}

/**
 * El enlace del pedido del comprador (`/compras/<publicId>?t=…`, etapa 8, D25) pasa por
 * `/compras/<publicId>/entrar?t=…`, que compara el token con el hash guardado y sólo entonces lo
 * guarda en la cookie del pedido (acá no hay base: nunca se escribe la cookie desde el proxy, así un
 * `?t=` cualquiera no pisa la que ya tiene el comprador).
 */
export function proxy(req: NextRequest) {
  // El cambio del `?t=` sólo aplica a `/compras/<publicId>` (exacto, como el matcher original): el
  // resto de las páginas pasa por el proxy únicamente para guardar el referido.
  if (!/^\/compras\/[^/]+\/?$/.test(req.nextUrl.pathname)) return conReferido(req, NextResponse.next());
  const t = req.nextUrl.searchParams.get("t");
  const publicId = req.nextUrl.pathname.split("/")[2] ?? "";
  if (!tokenConForma(t) || !isSalePublicId(publicId)) return conReferido(req, NextResponse.next());
  const destino = req.nextUrl.clone();
  destino.pathname = `/compras/${publicId}/entrar`;
  destino.search = "";
  destino.searchParams.set("t", t);
  const res = NextResponse.redirect(destino, 303);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return conReferido(req, res);
}

export const config = {
  matcher: [
    "/compras/:publicId",
    // Sólo corre cuando el link trae `?dnx_ref=`: el resto de las visitas ni pasa por acá.
    {
      source: "/((?!api|_next/static|_next/image|.*\\.[^/]+$).*)",
      has: [{ type: "query", key: "dnx_ref" }],
    },
  ],
};
