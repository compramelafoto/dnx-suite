import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashToken } from "@/lib/token-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/invitations/accept
 * Acepta invitación a álbum (AlbumInvitation). Requiere sesión + email verificado.
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

    const body = await req.json().catch(() => ({}));
    const token = (body.token ?? "").toString().trim();
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const invitation = await prisma.albumInvitation.findUnique({
      where: { tokenHash },
      include: {
        album: { select: { id: true, publicSlug: true, userId: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitación inválida" }, { status: 404 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!userRecord) {
      return NextResponse.json({ error: "Usuario inválido" }, { status: 401 });
    }

    // Idempotencia: ya aceptada por el mismo usuario
    if (
      invitation.status === "ACCEPTED" &&
      invitation.acceptedByUserId === userRecord.id
    ) {
      return NextResponse.json(
        {
          success: true,
          albumId: invitation.albumId,
          albumSlug: invitation.album?.publicSlug ?? null,
          alreadyAccepted: true,
        },
        { status: 200 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invitación no disponible" },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.albumInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Invitación expirada" }, { status: 400 });
    }

    const emailMatch =
      userRecord.email.toLowerCase() === invitation.invitedEmail.toLowerCase();
    const existingAccess = await prisma.albumAccess.findUnique({
      where: {
        albumId_userId: {
          albumId: invitation.albumId,
          userId: userRecord.id,
        },
      },
    });

    if (!emailMatch && !existingAccess) {
      return NextResponse.json(
        { error: "Email no autorizado para esta invitación" },
        { status: 403 }
      );
    }

    if (!userRecord.emailVerifiedAt) {
      return NextResponse.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.albumAccess.upsert({
        where: {
          albumId_userId: {
            albumId: invitation.albumId,
            userId: userRecord.id,
          },
        },
        update: {},
        create: {
          albumId: invitation.albumId,
          userId: userRecord.id,
          role: "VIEWER",
        },
      }),
      prisma.albumInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedByUserId: userRecord.id,
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        albumId: invitation.albumId,
        albumSlug: invitation.album?.publicSlug ?? null,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("POST /api/invitations/accept ERROR >>>", err);
    return NextResponse.json(
      { error: "Error aceptando la invitación" },
      { status: 500 }
    );
  }
}
