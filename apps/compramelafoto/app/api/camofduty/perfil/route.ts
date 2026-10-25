import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { clientIp, saveCamOfDutyProfile } from "@/lib/camofduty/account";
import { isProfileComplete, splitName, validateProfile } from "@/lib/camofduty/photographer-profile";
import { loadCamOfDutyAccount } from "@/lib/simulator/cam-of-duty-access";
import { camOfDutyGate } from "@/lib/simulator/cam-of-duty-visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/camofduty/perfil — lo que ya tiene la cuenta (para completar el formulario) y qué le falta. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión de nuevo." }, { status: 401 });
  const a = await loadCamOfDutyAccount(user.id);
  if (!a) return NextResponse.json({ error: "Iniciá sesión de nuevo." }, { status: 401 });
  const { firstName, lastName } = splitName(a.name);
  return NextResponse.json({
    email: a.email,
    gate: camOfDutyGate({ role: a.role, globalRole: a.globalRole, emailVerifiedAt: a.emailVerifiedAt, profileComplete: isProfileComplete(a) }),
    profile: {
      firstName,
      lastName,
      whatsapp: a.whatsapp ?? "",
      instagram: a.instagram ?? "",
      company: a.companyName ?? "",
      city: a.city ?? "",
      province: a.province ?? "",
      country: a.country ?? "",
      latitude: a.latitude,
      longitude: a.longitude,
      jobAlerts: a.camOfDutyMember?.jobAlertsOptIn ?? false,
    },
  });
}

/** POST /api/camofduty/perfil — guarda los datos del fotógrafo. */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión de nuevo." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const checked = validateProfile(body);
  if (!checked.ok) return NextResponse.json({ error: "Revisá los datos marcados.", errors: checked.errors }, { status: 400 });
  await saveCamOfDutyProfile(user.id, checked.profile, clientIp(req));
  return NextResponse.json({ ok: true });
}
