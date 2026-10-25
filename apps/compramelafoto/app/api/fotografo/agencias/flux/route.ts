import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { FLUX_KEY_MESSAGES, issueLinkCode, listDeviceKeys, userCanLinkFlux } from "@/lib/agencies/flux-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) };
  return { user };
}

/** Computadoras vinculadas con DNX FLUX (sirven para todas las agencias del fotógrafo). */
export async function GET() {
  const a = await auth();
  if ("res" in a) return a.res;
  return NextResponse.json({ devices: await listDeviceKeys(a.user.id) });
}

/** Código corto para vincular una computadora nueva (vence a los 10 minutos). */
export async function POST() {
  const a = await auth();
  if ("res" in a) return a.res;
  if (!(await userCanLinkFlux(a.user.id))) return NextResponse.json({ error: FLUX_KEY_MESSAGES.notMember }, { status: 403 });
  const r = await issueLinkCode(a.user.id);
  return NextResponse.json({ code: r.code, expiresAt: r.expiresAt.toISOString() });
}
