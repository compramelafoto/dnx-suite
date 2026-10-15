import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@repo/db";

import { normalizeReferralCode } from "@/lib/referrals/domain/code";
import {
  REFERRAL_COOKIE_NAME,
  opcionesCookieReferido,
} from "@/lib/referrals/domain/cookie";
import { destinoDeLaInvitacion } from "@/lib/referrals/domain/destino-invitacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/**
 * Link de invitación de un participante: `/i/<code>`.
 *
 * `/r/` ya es el redirect de DNX Partners (tracking de sponsors) y no se toca.
 *
 * Un código inválido **nunca** devuelve 404: quien llega acá fue invitado por
 * alguien y merece entrar igual, sólo que sin atribución.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { code: rawCode } = await params;

  const ediciones = await prisma.clickatonEdition.findMany({
    where: { isPublished: true, isOpsFixture: false },
    select: {
      slug: true,
      isPublished: true,
      registrationEnabled: true,
      status: true,
      isOpsFixture: true,
    },
  });
  const response = NextResponse.redirect(
    new URL(destinoDeLaInvitacion(ediciones), request.url),
    302,
  );

  // Gana el primero: quien trajo a la persona al sitio hizo el trabajo, y una
  // visita posterior por otro link no se lo saca.
  if (request.cookies.get(REFERRAL_COOKIE_NAME)?.value) return response;

  const code = normalizeReferralCode(rawCode ?? "");
  if (!code) return response;

  const codigo = await prisma.clickatonReferralCode.findUnique({
    where: { code },
    select: { isActive: true },
  });
  if (!codigo?.isActive) return response;

  response.cookies.set(REFERRAL_COOKIE_NAME, code, opcionesCookieReferido());
  return response;
}
