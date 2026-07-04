import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { buildPasswordChangedEmail } from "@/emails/templates/auth";
import { sendEmail } from "@/emails/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json(
        { error: error || "Debés iniciar sesión para cambiar tu contraseña" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = (body.currentPassword ?? "").toString();
    const newPassword = (body.newPassword ?? "").toString();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "La contraseña actual y la nueva son requeridas" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, password: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!dbUser.password) {
      return NextResponse.json(
        { error: "Tu cuenta usa inicio de sesión con Google. No tenés contraseña para cambiar." },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    try {
      const { subject, html } = buildPasswordChangedEmail({
        firstName: dbUser.name || undefined,
      });
      await sendEmail({
        to: dbUser.email,
        subject,
        html,
        templateKey: "AUTH03_PASSWORD_CHANGED",
        meta: { userId: dbUser.id },
      });
    } catch (emailErr) {
      console.error("CHANGE PASSWORD: error enviando confirmación", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (err: unknown) {
    console.error("POST /api/auth/change-password ERROR >>>", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Error al cambiar la contraseña", detail: message },
      { status: 500 }
    );
  }
}
