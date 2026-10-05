import { NextResponse } from "next/server";
import { clearFotofficeSessionCookies } from "@/lib/session-cookie";
import { safeFotofficeNextPath } from "@/lib/google-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  // Quien sale desde el sitio de una institución vuelve al sitio, no a la pantalla de login.
  // Sólo direcciones internas (`safeFotofficeNextPath`): nunca un redirect a otro sitio.
  let next: string | undefined;
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    next = safeFotofficeNextPath(form?.get("next")?.toString());
  }
  await clearFotofficeSessionCookies();
  return NextResponse.redirect(new URL(next ?? "/login", origin), { status: 303 });
}

export async function GET(req: Request) {
  return POST(req);
}
