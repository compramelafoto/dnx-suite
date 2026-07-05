import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logPrivacyEvent } from "@/lib/privacy-face";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * PATCH /api/users/me/face-consent
 * Body: { faceConsent: boolean }
 * Registra consentimiento para usar búsqueda por rostro.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const faceConsent = !!body.faceConsent;
    const ip = getClientIp(req);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        faceConsent,
        faceConsentAt: faceConsent ? new Date() : undefined,
        faceConsentIp: faceConsent ? ip : undefined,
      },
    });

    if (faceConsent) {
      await logPrivacyEvent({
        eventType: "FACE_CONSENT_GIVEN",
        userId: user.id,
        metadata: { ip },
      });
    } else {
      await logPrivacyEvent({
        eventType: "FACE_CONSENT_REVOKED",
        userId: user.id,
        metadata: { ip },
      });
    }

    return NextResponse.json({ success: true, faceConsent });
  } catch (err: any) {
    console.error("PATCH /api/users/me/face-consent ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al actualizar consentimiento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
