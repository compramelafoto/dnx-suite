import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TokenPurpose } from "@prisma/client";
import { hashToken } from "@/lib/token-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyByToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.emailVerificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!token || token.usedAt || token.expiresAt < new Date() || token.purpose !== TokenPurpose.VERIFY_EMAIL) {
    return { ok: false, error: "Token inválido o expirado" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    await tx.user.updateMany({
      where: { email: token.email },
      data: { emailVerifiedAt: new Date() },
    });
  });

  return { ok: true };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") ?? "").toString().trim();
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }
  const result = await verifyByToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = (body.token ?? "").toString().trim();
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }
  const result = await verifyByToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
