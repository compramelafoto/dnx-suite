import { NextResponse } from "next/server";
import { hashPassword, normalizeIdentityEmail } from "@repo/auth";
import { setAuthCookieOnResponse } from "@/lib/auth";
import { prisma, Role } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, saveCamOfDutyProfile, sendEmailCode } from "@/lib/camofduty/account";
import { validateProfile } from "@/lib/camofduty/photographer-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/camofduty/registro — alta de fotógrafo desde Cam Of Duty.
 * Crea la cuenta de fotógrafo de CompraMeLaFoto con sus datos, deja la sesión
 * iniciada y manda el código para validar el email.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!checkRateLimit({ key: `camofduty-registro:${ip}`, limit: 8, windowMs: 10 * 60_000 }).allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeIdentityEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const errors: Record<string, string> = {};
  if (!normalized.ok) errors.email = "Escribí un email válido.";
  if (password.length < 8) errors.password = "La contraseña tiene que tener al menos 8 caracteres.";
  if (body.acceptTerms !== true) errors.acceptTerms = "Tenés que aceptar los términos y la política de privacidad.";
  const checked = validateProfile(body);
  if (!checked.ok) Object.assign(errors, checked.errors);
  if (Object.keys(errors).length > 0 || !checked.ok || !normalized.ok) {
    return NextResponse.json({ error: "Revisá los datos marcados.", errors }, { status: 400 });
  }
  const email = normalized.email;
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    return NextResponse.json(
      { error: "Ya hay una cuenta con ese email. Ingresá con tu contraseña o con Google.", exists: true },
      { status: 409 },
    );
  }
  const profile = checked.profile;
  const user = await prisma.user.create({
    data: {
      email,
      name: `${profile.firstName} ${profile.lastName}`,
      password: hashPassword(password),
      role: Role.PHOTOGRAPHER,
      workingCoverageRadiusKm: 50,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  await saveCamOfDutyProfile(user.id, profile, ip);
  const sent = await sendEmailCode(email, profile.firstName);
  const response = NextResponse.json({ ok: true, codeSent: sent.ok }, { status: 201 });
  await setAuthCookieOnResponse(response, { id: user.id, email: user.email, name: user.name, role: user.role });
  return response;
}
