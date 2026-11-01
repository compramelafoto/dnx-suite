import { NextResponse, type NextRequest } from "next/server";
import {
  buildSuiteReferralSetCookie,
  SUITE_REFERRAL_COOKIE,
  suiteReferralCodeToStore,
} from "@repo/auth/suite-referral";

/**
 * Referidos de DNX Suite: si la visita llega con `?dnx_ref=CODIGO` (y no tiene ya uno guardado:
 * el primer link gana), se guarda en la cookie `dnx_ref`. Se usa cuando la persona crea su cuenta
 * en FotoRank (crear cuenta, Google o postulación de jurado) para avisarle a ComprameLaFoto quién
 * la refirió. Este proxy no hace nada más: deja pasar todos los pedidos tal cual.
 */
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const codigo = suiteReferralCodeToStore(req.nextUrl, req.cookies.get(SUITE_REFERRAL_COOKIE)?.value);
  if (codigo) {
    res.headers.append(
      "Set-Cookie",
      buildSuiteReferralSetCookie(codigo, req.nextUrl.protocol === "https:"),
    );
  }
  return res;
}

export const config = {
  matcher: [
    // Sólo corre cuando el link trae `?dnx_ref=`: el resto de las visitas ni pasa por acá.
    {
      source: "/((?!api|_next/static|_next/image|.*\\.[^/]+$).*)",
      has: [{ type: "query", key: "dnx_ref" }],
    },
  ],
};
