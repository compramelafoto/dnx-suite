import { getCurrentUser } from "@repo/auth-guards";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { computeLevel } from "@/lib/identidad/nivel";
import { getIdentityProvider } from "@/lib/identidad/proveedor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicia la verificación de identidad. Exige sesión, nivel "telefono" y el consentimiento
 * explícito (checkbox `consent`), que se guarda como `consentAt`.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión" }, { status: 401 });

  const [dbUser, phone, identity] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } }),
    prisma.phoneVerification.findUnique({
      where: { userId: user.id },
      select: { verifiedAt: true },
    }),
    prisma.identityVerification.findUnique({
      where: { userId: user.id },
      select: { status: true, reverifyRequiredAt: true },
    }),
  ]);
  const level = computeLevel({
    emailVerifiedAt: dbUser?.emailVerifiedAt ?? null,
    phoneVerifiedAt: phone?.verifiedAt ?? null,
    identity: identity ?? null,
  });
  if (level !== "telefono" && level !== "identidad") {
    return NextResponse.json(
      { error: "Primero verificá tu correo y tu celular" },
      { status: 403 },
    );
  }
  if (identity?.status === "APPROVED" && identity.reverifyRequiredAt === null) {
    return NextResponse.json({ error: "Tu identidad ya está verificada" }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  if (form?.get("consent") !== "on") {
    return NextResponse.json(
      { error: "Tenés que aceptar el consentimiento para continuar" },
      { status: 400 },
    );
  }

  const provider = getIdentityProvider();
  const { redirectUrl, providerRef } = await provider.startSession({
    userId: user.id,
    returnUrl: "/verificacion",
  });

  await prisma.identityVerification.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: "PENDING",
      provider: provider.name,
      providerRef,
      consentAt: new Date(),
    },
    update: {
      status: "PENDING",
      provider: provider.name,
      providerRef,
      consentAt: new Date(),
      rejectionReason: null,
    },
  });

  return NextResponse.redirect(new URL(redirectUrl, req.url), 303);
}
