import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@repo/auth";
import { prisma, TokenPurpose } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashToken } from "@/lib/token-hash";
import { isLikelyValidEmail, normalizeEmail } from "@/lib/email-validation";
import {
  CAMBIO_EMAIL_HORAS,
  codificarCambioEmail,
  decodificarCambioEmail,
  prefijoCambioEmailDeUsuario,
} from "@/lib/auth/cambio-email";
import {
  buildConfirmEmailChangeEmail,
  buildEmailChangeRequestedNoticeEmail,
} from "@/emails/templates/auth";
import { sendEmail } from "@/emails/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pedidos de cambio por usuario en la última hora (evita usar la pantalla para mandar correos a terceros). */
const MAX_PEDIDOS_POR_HORA = 5;

function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** GET: email actual, si hay un cambio pendiente y si el pedido exige la contraseña. */
export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, password: true },
  });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const pendiente = await prisma.emailVerificationToken.findFirst({
    where: {
      purpose: TokenPurpose.VERIFY_EMAIL,
      email: { startsWith: prefijoCambioEmailDeUsuario(user.id) },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });

  return NextResponse.json({
    email: dbUser.email,
    requiresPassword: Boolean(dbUser.password),
    pendingEmail: pendiente ? decodificarCambioEmail(pendiente.email)?.emailNuevo ?? null : null,
  });
}

/** POST { newEmail, currentPassword? }: manda el enlace de confirmación a la dirección nueva. */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json(
        { error: error || "Tenés que iniciar sesión para cambiar tu email" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const newEmail = normalizeEmail(String(body.newEmail ?? ""));
    const currentPassword = String(body.currentPassword ?? "");

    if (!isLikelyValidEmail(newEmail)) {
      return NextResponse.json({ error: "Escribí un email válido." }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, password: true },
    });
    if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (normalizeEmail(dbUser.email) === newEmail) {
      return NextResponse.json({ error: "Ése ya es tu email actual." }, { status: 400 });
    }

    // Con contraseña propia, se pide para que nadie con la sesión abierta se quede con la cuenta.
    if (dbUser.password) {
      if (!currentPassword || !verifyPassword(currentPassword, dbUser.password)) {
        return NextResponse.json({ error: "La contraseña actual es incorrecta." }, { status: 400 });
      }
    }

    const ocupado = await prisma.user.findFirst({
      where: { email: { equals: newEmail, mode: "insensitive" }, NOT: { id: dbUser.id } },
      select: { id: true },
    });
    if (ocupado) {
      return NextResponse.json(
        { error: "Ese email ya está en uso en otra cuenta de ComprameLaFoto." },
        { status: 409 }
      );
    }

    const prefijo = prefijoCambioEmailDeUsuario(dbUser.id);
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
    const recientes = await prisma.emailVerificationToken.count({
      where: { purpose: TokenPurpose.VERIFY_EMAIL, email: { startsWith: prefijo }, createdAt: { gt: haceUnaHora } },
    });
    if (recientes >= MAX_PEDIDOS_POR_HORA) {
      return NextResponse.json(
        { error: "Pediste muchos cambios seguidos. Probá de nuevo en una hora." },
        { status: 429 }
      );
    }

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + CAMBIO_EMAIL_HORAS * 60 * 60 * 1000);
    await prisma.$transaction([
      // Sólo vale el último pedido: los anteriores quedan anulados.
      prisma.emailVerificationToken.updateMany({
        where: { purpose: TokenPurpose.VERIFY_EMAIL, email: { startsWith: prefijo }, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.emailVerificationToken.create({
        data: {
          email: codificarCambioEmail(dbUser.id, newEmail),
          token: hashToken(rawToken),
          purpose: TokenPurpose.VERIFY_EMAIL,
          expiresAt,
        },
      }),
    ]);

    const firstName = dbUser.name?.trim().split(/\s+/)[0] || undefined;
    const confirmUrl = `${appUrl()}/cuenta/confirmar-email?token=${rawToken}`;

    const confirm = buildConfirmEmailChangeEmail({ firstName, confirmUrl, newEmail });
    const sent = await sendEmail({
      to: newEmail,
      subject: confirm.subject,
      html: confirm.html,
      templateKey: "AUTH05_EMAIL_CHANGE_CONFIRM",
      meta: { userId: dbUser.id },
    });
    if (sent && "success" in sent && sent.success === false) {
      return NextResponse.json(
        { error: "No pudimos enviar el correo de confirmación. Probá de nuevo en unos minutos." },
        { status: 502 }
      );
    }

    try {
      const aviso = buildEmailChangeRequestedNoticeEmail({ firstName, newEmail });
      await sendEmail({
        to: dbUser.email,
        subject: aviso.subject,
        html: aviso.html,
        templateKey: "AUTH06_EMAIL_CHANGE_NOTICE",
        meta: { userId: dbUser.id },
      });
    } catch (avisoErr) {
      console.error("CAMBIAR EMAIL: no se pudo avisar al email anterior", avisoErr);
    }

    return NextResponse.json({ success: true, pendingEmail: newEmail });
  } catch (err) {
    console.error("POST /api/cuenta/cambiar-email ERROR", err);
    return NextResponse.json({ error: "No se pudo pedir el cambio de email." }, { status: 500 });
  }
}
