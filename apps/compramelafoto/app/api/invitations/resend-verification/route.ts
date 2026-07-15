import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TokenPurpose } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!raw) return "http://localhost:3000";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /api/invitations/resend-verification
 * Reenvía email de verificación al usuario autenticado.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autenticado" },
        { status: 401 }
      );
    }

    const ip = clientIp(req);
    const rl = checkRateLimit({
      key: `resend-verify:${user.id}:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá más tarde." },
        { status: 429 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario inválido" }, { status: 400 });
    }

    if (dbUser.emailVerifiedAt) {
      return NextResponse.json(
        { success: true, message: "El email ya está verificado." },
        { status: 200 }
      );
    }

    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpires = new Date();
    verifyExpires.setHours(verifyExpires.getHours() + 24);
    const verifyUrl = `${resolveAppUrl()}/verify-email?token=${verifyToken}`;

    await prisma.emailVerificationToken.create({
      data: {
        email: dbUser.email,
        token: hashToken(verifyToken),
        purpose: TokenPurpose.VERIFY_EMAIL,
        expiresAt: verifyExpires,
      },
    });

    const { subject, html } = buildVerifyEmail({
      firstName: dbUser.name || undefined,
      verifyUrl,
    });

    await sendEmail({
      to: dbUser.email,
      subject,
      html,
      templateKey: "AUTH01_VERIFY_EMAIL",
      meta: { userId: dbUser.id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("POST /api/invitations/resend-verification ERROR >>>", err);
    return NextResponse.json(
      { error: "Error reenviando verificación" },
      { status: 500 }
    );
  }
}
