import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/guards";
import { getIdentityProvider } from "@/lib/identidad/proveedor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicia la verificación de identidad. Exige sesión, nivel "telefono" y el consentimiento
 * explícito (checkbox `consent`), que se guarda como `consentAt`.
 */
export async function POST(req: Request) {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  if (user.blocked) return NextResponse.json({ error: "Tu cuenta está suspendida." }, { status: 403 });

  const { level, identity } = user;
  if (level !== "telefono" && level !== "identidad") {
    return NextResponse.json(
      { error: "Primero verificá tu correo y tu celular" },
      { status: 403 },
    );
  }
  if (identity?.status === "APPROVED" && identity.reverifyRequiredAt === null) {
    return NextResponse.json({ error: "Tu identidad ya está verificada" }, { status: 409 });
  }

  if (identity?.status === "IN_REVIEW") {
    return NextResponse.json({ error: "Tu verificación está en revisión" }, { status: 409 });
  }
  if (
    identity?.status === "REJECTED" &&
    (identity.reviewedById !== null || identity.rejectionReason === "DNI_YA_USADO")
  ) {
    return NextResponse.json(
      { error: "Esta verificación no puede reiniciarse; contactá a soporte" },
      { status: 409 },
    );
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
      // Reinicio: se pierde la marca de revisión manual anterior (si no, un rechazo del
      // proveedor quedaría bloqueado para siempre).
      reviewedById: null,
    },
  });

  return NextResponse.redirect(new URL(redirectUrl, req.url), 303);
}
