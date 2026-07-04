import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFaceTemplatesForUser, logPrivacyEvent } from "@/lib/privacy-face";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * POST /api/users/me/revoke-face-consent
 * Revoca consentimiento facial y elimina plantillas/embeddings del usuario.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const ip = getClientIp(req);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        faceConsent: false,
        faceConsentAt: null,
        faceConsentIp: null,
      },
    });

    const { deleted, errors } = await deleteFaceTemplatesForUser(user.id);

    await logPrivacyEvent({
      eventType: "FACE_TEMPLATES_DELETED",
      userId: user.id,
      metadata: { ip, deleted, errors: errors.length > 0 ? errors : undefined },
    });

    return NextResponse.json({
      success: true,
      faceConsent: false,
      templatesDeleted: deleted,
    });
  } catch (err: any) {
    console.error("POST /api/users/me/revoke-face-consent ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al desactivar reconocimiento facial", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
