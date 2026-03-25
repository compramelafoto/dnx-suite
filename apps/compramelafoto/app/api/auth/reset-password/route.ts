import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildPasswordChangedEmail } from "@/emails/templates/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = (body.token ?? "").toString().trim();
    const password = (body.password ?? "").toString();

    if (!token) {
      return NextResponse.json(
        { error: "El token es requerido" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const tokenModel = (prisma as any).passwordResetToken;
    let resetToken: any = null;
    if (tokenModel?.findUnique) {
      const tokenHash = hashToken(token);
      resetToken = await tokenModel.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        // Fallback a token legacy en User
        const userFallback = await prisma.user.findUnique({
          where: { passwordResetToken: token },
          select: {
            id: true,
            email: true,
            name: true,
            passwordResetToken: true,
            passwordResetExpires: true,
          },
        });
        if (!userFallback || !userFallback.passwordResetExpires || userFallback.passwordResetExpires < new Date()) {
          return NextResponse.json(
            { error: "Token inválido o expirado" },
            { status: 400 }
          );
        }
        resetToken = { user: userFallback, id: null };
      }
    } else {
      // Fallback si el cliente Prisma no fue regenerado aún
      const user = await prisma.user.findUnique({
        where: { passwordResetToken: token },
        select: {
          id: true,
          email: true,
          name: true,
          passwordResetToken: true,
          passwordResetExpires: true,
        },
      });
      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return NextResponse.json(
          { error: "Token inválido o expirado" },
          { status: 400 }
        );
      }
      resetToken = { user, id: null };
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña y limpiar token
    if (tokenModel?.update && resetToken?.id) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: resetToken.user.id },
          data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        });
        await (tx as any).passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        });
      });
    } else {
      await prisma.user.update({
        where: { id: resetToken.user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
    }

    try {
      const { subject, html } = buildPasswordChangedEmail({
        firstName: resetToken.user.name || undefined,
      });
      await sendEmail({
        to: resetToken.user.email,
        subject,
        html,
        templateKey: "AUTH03_PASSWORD_CHANGED",
        meta: { userId: resetToken.user.id },
      });
    } catch (emailErr) {
      console.error("RESET PASSWORD: error enviando confirmación", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña restablecida correctamente. Ya podés iniciar sesión.",
    });
  } catch (err: any) {
    console.error("POST /api/auth/reset-password ERROR >>>", err);
    return NextResponse.json(
      { error: "Error restableciendo contraseña", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
