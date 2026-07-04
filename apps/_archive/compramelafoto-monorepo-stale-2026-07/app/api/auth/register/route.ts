import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role, TokenPurpose } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name ?? "").toString().trim();
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();

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
      select: { id: true, email: true }, // Solo seleccionar campos que sabemos que existen
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determinar rol: por defecto CUSTOMER (cliente final)
    const requestedRole = (body.role ?? "").toString().toUpperCase();
    let role: Role = Role.CUSTOMER;
    
    // Este endpoint solo se usa para CUSTOMER (clientes finales)
    // Para PHOTOGRAPHER usar /api/auth/register-photographer
    // Para LAB usar /api/auth/register-lab

    const marketingOptIn = !!body.marketingOptIn;
    const ip = getClientIp(req);

    const userData: Record<string, unknown> = {
      email,
      name,
      password: hashedPassword,
      role,
      marketingOptIn,
    };
    if (marketingOptIn) {
      userData.marketingOptInAt = new Date();
      userData.marketingOptInIp = ip;
      userData.marketingOptInSource = "signup";
      userData.unsubscribeToken = randomBytes(24).toString("hex");
    }

    // Crear usuario
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
      console.error("REGISTER: error enviando verificación", emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Usuario creado correctamente. Revisá tu email para verificar tu cuenta.",
        user,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("REGISTER ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear usuario", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
