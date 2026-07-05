import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildResetPasswordEmail } from "@/emails/templates/auth";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").toString().trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "El email es requerido" },
        { status: 400 }
      );
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Por seguridad, siempre devolvemos éxito aunque el usuario no exista
    // Esto previene que se pueda descubrir qué emails están registrados
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "Si el email existe, recibirás un enlace para restablecer tu contraseña.",
      });
    }

    // Generar token único
    const resetToken = randomBytes(32).toString("hex");
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // Expira en 1 hora

    const resetTokenModel = (prisma as any).passwordResetToken;
    if (resetTokenModel?.create) {
      // Guardar token en la base de datos (hashed)
      await resetTokenModel.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(resetToken),
          expiresAt: resetExpires,
        },
      });
    }
    // Mantener compatibilidad con tokens legacy en User
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Generar URL de reset
    const baseUrl = resolveAppUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Enviar email
    const { subject, html } = buildResetPasswordEmail({
      firstName: user.name || undefined,
      resetUrl,
    });
    const emailResult = await sendEmail({
      to: user.email,
      subject,
      html,
      templateKey: "AUTH02_RESET_PASSWORD",
      meta: { userId: user.id },
    });

    if (!emailResult.success) {
      console.error("Error enviando email de recuperación:", emailResult.error);
      // No fallar la operación, pero loguear el error
    }

    return NextResponse.json({
      success: true,
      message: "Si el email existe, recibirás un enlace para restablecer tu contraseña.",
    });
  } catch (err: any) {
    console.error("POST /api/auth/forgot-password ERROR >>>", err);
    return NextResponse.json(
      { error: "Error procesando solicitud", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
