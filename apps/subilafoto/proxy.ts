import { NextResponse, type NextRequest } from "next/server";
import {
  buildSuiteReferralSetCookie,
  SUITE_REFERRAL_COOKIE,
  suiteReferralCodeToStore,
} from "@repo/auth/suite-referral";

/**
 * Referidos de DNX Suite: si alguien llega con `?dnx_ref=CODIGO`, se guarda el código en la
 * cookie `dnx_ref` (30 días; el primer link gana) para avisarle a ComprameLaFoto quién lo
 * refirió cuando cree su cuenta (ver `app/api/auth/google/callback/route.ts`).
 *
 * No hace nada más: no redirige ni reescribe. El matcher sólo lo activa cuando la URL trae
 * `dnx_ref`, así el resto de las páginas (la portada se sirve estática) ni pasa por acá.
 */
export function proxy(request: NextRequest) {
  const respuesta = NextResponse.next();
  const codigo = suiteReferralCodeToStore(
    request.nextUrl,
    request.cookies.get(SUITE_REFERRAL_COOKIE)?.value,
  );
  if (codigo) {
    respuesta.headers.append(
      "Set-Cookie",
      buildSuiteReferralSetCookie(codigo, request.nextUrl.protocol === "https:"),
    );
  }
  return respuesta;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      has: [{ type: "query", key: "dnx_ref" }],
    },
  ],
};
