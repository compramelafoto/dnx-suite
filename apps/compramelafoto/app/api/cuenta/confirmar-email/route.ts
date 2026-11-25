import { NextRequest, NextResponse } from "next/server";
import { prisma, TokenPurpose } from "@/lib/prisma";
import { hashToken } from "@/lib/token-hash";
import { decodificarCambioEmail } from "@/lib/auth/cambio-email";
import { buildEmailChangedNoticeEmail } from "@/emails/templates/auth";
import { sendEmail } from "@/emails/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { token }: confirma el cambio de email desde el enlace que llegó a la dirección nueva.
 * No exige sesión: el enlace prueba que la persona controla el email nuevo, y el pedido
 * ya se hizo con la sesión (y la contraseña) de la cuenta.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawToken = String(body.token ?? "").trim();
    if (!rawToken) return NextResponse.json({ error: "Falta el enlace de confirmación." }, { status: 400 });

    const token = await prisma.emailVerificationToken.findUnique({ where: { token: hashToken(rawToken) } });
    const pedido = token ? decodificarCambioEmail(token.email) : null;
    if (
      !token ||
      !pedido ||
      token.purpose !== TokenPurpose.VERIFY_EMAIL ||
      token.usedAt ||
      token.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: "El enlace venció o ya se usó. Pedí el cambio de nuevo desde tu cuenta." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: pedido.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) return NextResponse.json({ error: "La cuenta ya no existe." }, { status: 404 });

    const emailAnterior = user.email;
    const emailNuevo = pedido.emailNuevo;

    const ocupado = await prisma.user.findFirst({
      where: { email: { equals: emailNuevo, mode: "insensitive" }, NOT: { id: user.id } },
      select: { id: true },
    });
    if (ocupado) {
      return NextResponse.json(
        { error: "Ese email ya está en uso en otra cuenta de ComprameLaFoto." },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Marca el enlace como usado sólo si nadie lo usó en paralelo.
      const marcado = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (marcado.count !== 1) throw new Error("TOKEN_YA_USADO");

      await tx.user.update({
        where: { id: user.id },
        data: { email: emailNuevo, emailVerifiedAt: new Date() },
      });

      // Pedidos hechos con el email anterior y sin cuenta asociada: se atan a la cuenta para que
      // el cliente los siga viendo (algunas pantallas los buscaban por email).
      await tx.printOrder.updateMany({
        where: { clientId: null, customerEmail: { equals: emailAnterior, mode: "insensitive" } },
        data: { clientId: user.id },
      });
      await tx.order.updateMany({
        where: { buyerUserId: null, buyerEmail: { equals: emailAnterior, mode: "insensitive" } },
        data: { buyerUserId: user.id },
      });
    });

    const firstName = user.name?.trim().split(/\s+/)[0] || undefined;
    const aviso = buildEmailChangedNoticeEmail({ firstName, newEmail: emailNuevo });
    for (const to of [emailAnterior, emailNuevo]) {
      try {
        await sendEmail({
          to,
          subject: aviso.subject,
          html: aviso.html,
          templateKey: "AUTH06_EMAIL_CHANGE_NOTICE",
          meta: { userId: user.id },
        });
      } catch (avisoErr) {
        console.error("CONFIRMAR EMAIL: no se pudo enviar el aviso", avisoErr);
      }
    }

    return NextResponse.json({ success: true, email: emailNuevo });
  } catch (err) {
    if (err instanceof Error && err.message === "TOKEN_YA_USADO") {
      return NextResponse.json(
        { error: "El enlace venció o ya se usó. Pedí el cambio de nuevo desde tu cuenta." },
        { status: 400 }
      );
    }
    console.error("POST /api/cuenta/confirmar-email ERROR", err);
    return NextResponse.json({ error: "No se pudo confirmar el cambio de email." }, { status: 500 });
  }
}
