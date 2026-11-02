/**
 * POST /api/referrals/suite-signup — otra plataforma de DNX Suite avisa que alguien
 * creó su cuenta con un código de referido de CLF. Llamada servidor a servidor,
 * autenticada con el secreto compartido DNX_SUITE_REFERRAL_SECRET.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SUITE_REFERRAL_SECRET_HEADER } from "@repo/auth/suite-referral";
import {
  isValidSuiteReferralSecret,
  parseSuiteReferralSignupBody,
  recordSuiteReferralSignup,
} from "@/lib/referral/suite-referral-signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (
    !isValidSuiteReferralSecret(
      request.headers.get(SUITE_REFERRAL_SECRET_HEADER),
      process.env.DNX_SUITE_REFERRAL_SECRET,
    )
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = parseSuiteReferralSignupBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const row = await recordSuiteReferralSignup(prisma as never, parsed.input);
    return NextResponse.json({ ok: true, outcome: row.outcome });
  } catch (err) {
    console.error("[referrals.suite-signup] no se pudo guardar", {
      platform: parsed.input.platform,
      code: parsed.input.code,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
