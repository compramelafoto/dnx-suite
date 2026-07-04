import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TokenPurpose } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";

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

export async function POST() {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario inválido" }, { status: 400 });
  }

  if (dbUser.emailVerifiedAt) {
    return NextResponse.json({ success: true, message: "El email ya está verificado." }, { status: 200 });
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
}
