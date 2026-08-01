import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReferralProgram, Role, TokenPurpose } from "@/lib/prisma";
import { hashPassword } from "@repo/auth";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";
import { CC_PRODUCT_KEY } from "@/lib/cuantocobro/constants";
import { buildCuantoCobroSignupUserFields } from "@/lib/cuantocobro/user-access";
import { tryCreateReferralAttributionOnSignup } from "@/lib/referral/referral-signup-attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name ?? "").toString().trim();
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();
    const refCode = (body.ref ?? "").toString().trim();
    const sourceTypeRaw = (body.sourceType ?? "").toString().trim();
    const sourceEntityRaw = body.sourceEntityId;
    const marketingOptIn = !!body.marketingOptIn;
    const productSource = (body.productSource ?? body.signupSource ?? "").toString().trim().toLowerCase();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = hashPassword(password);

    const ip = getClientIp(req);
    const userData: Record<string, unknown> = {
      email,
      name,
      password: hashedPassword,
      role: Role.PHOTOGRAPHER,
      marketingOptIn,
      workingCoverageRadiusKm: 50,
    };
    if (marketingOptIn) {
      userData.marketingOptInAt = new Date();
      userData.marketingOptInIp = ip;
      userData.marketingOptInSource = "signup";
      userData.unsubscribeToken = randomBytes(24).toString("hex");
    }
    if (productSource === CC_PRODUCT_KEY) {
      Object.assign(userData, buildCuantoCobroSignupUserFields());
    }

    // Crear usuario como PHOTOGRAPHER
    const user = await prisma.user.create({
      data: userData as any,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpires = new Date();
    verifyExpires.setHours(verifyExpires.getHours() + 24);
    const verifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${verifyToken}`;

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token: hashToken(verifyToken),
        purpose: TokenPurpose.VERIFY_EMAIL,
        expiresAt: verifyExpires,
      },
    });

    try {
      const { subject, html } = buildVerifyEmail({
        firstName: user.name || undefined,
        verifyUrl,
      });
      await sendEmail({
        to: user.email,
        subject,
        html,
        templateKey: "AUTH01_VERIFY_EMAIL",
        meta: { userId: user.id },
      });
    } catch (emailErr) {
      console.error("REGISTER PHOTOGRAPHER: error enviando verificación", emailErr);
    }

    await tryCreateReferralAttributionOnSignup({
      referredUserId: user.id,
      referredUserEmail: email,
      referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
      refCode,
      sourceTypeRaw,
      sourceEntityRaw,
      logContext: "REGISTER PHOTOGRAPHER",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Cuenta de fotógrafo creada. Revisá tu email para verificarla.",
        user,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("REGISTER PHOTOGRAPHER ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear cuenta", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
