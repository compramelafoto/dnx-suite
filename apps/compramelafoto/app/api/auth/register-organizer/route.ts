import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReferralProgram, Role, TokenPurpose } from "@/lib/prisma";
import { hashPassword } from "@repo/auth";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";
import { tryCreateReferralAttributionOnSignup } from "@/lib/referral/referral-signup-attribution";
import { resolveSignupReferralInput } from "@/lib/referral/resolve-signup-referral-input";

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
    // Ref del formulario y, si no vino, de la cookie clf_ref del link de referido.
    const { refCode, sourceTypeRaw, sourceEntityRaw } = resolveSignupReferralInput(req, body);
    const marketingOptIn = !!body.marketingOptIn;

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

    const hashedPassword = hashPassword(password);

    const ip = getClientIp(req);
    const userData: Record<string, unknown> = {
      email,
      name,
      password: hashedPassword,
      role: Role.ORGANIZER,
      marketingOptIn,
    };
    if (marketingOptIn) {
      userData.marketingOptInAt = new Date();
      userData.marketingOptInIp = ip;
      userData.marketingOptInSource = "signup";
      userData.unsubscribeToken = randomBytes(24).toString("hex");
    }

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
      console.error("REGISTER ORGANIZER: error enviando verificación", emailErr);
    }

    await tryCreateReferralAttributionOnSignup({
      referredUserId: user.id,
      referredUserEmail: email,
      referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
      refCode,
      sourceTypeRaw,
      sourceEntityRaw,
      logContext: "REGISTER ORGANIZER",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Cuenta de organizador creada. Revisá tu email para verificarla.",
        user,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("REGISTER ORGANIZER ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear cuenta", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
