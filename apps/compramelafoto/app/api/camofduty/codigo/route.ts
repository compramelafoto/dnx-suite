import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sendEmailCode } from "@/lib/camofduty/account";
import { splitName } from "@/lib/camofduty/photographer-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/camofduty/codigo — manda un código nuevo al email de la cuenta con sesión. */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión de nuevo." }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });
  const sent = await sendEmailCode(user.email, splitName(user.name).firstName || null);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });
  return NextResponse.json({ ok: true });
}
