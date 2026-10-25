import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { verifyEmailCode } from "@/lib/camofduty/account";
import { cleanEmailCode } from "@/lib/camofduty/photographer-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/camofduty/verificar — valida el email con el código de 6 dígitos. */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión de nuevo." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const code = cleanEmailCode(body.code);
  if (!code) return NextResponse.json({ error: "El código tiene 6 números." }, { status: 400 });
  const result = await verifyEmailCode(user.id, user.email, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
