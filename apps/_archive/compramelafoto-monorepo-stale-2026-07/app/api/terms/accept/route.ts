import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { LAB_TERMS_VERSION } from "@/lib/terms/labTerms";
import { PHOTOGRAPHER_TERMS_VERSION } from "@/lib/terms/photographerTermsExtended";

export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { role, acceptedIp, acceptedUserAgent } = body;

    // Determinar rol y versión
    const targetRole = role || (user.role === Role.LAB_PHOTOGRAPHER ? Role.LAB : user.role);
    const activeVersion = targetRole === Role.LAB || targetRole === Role.LAB_PHOTOGRAPHER
      ? LAB_TERMS_VERSION
      : PHOTOGRAPHER_TERMS_VERSION;

    // Verificar que existe el documento de términos
    const termsDoc = await prisma.termsDocument.findFirst({
      where: {
        role: targetRole === Role.LAB_PHOTOGRAPHER ? Role.LAB : targetRole,
        version: activeVersion,
        isActive: true,
      },
    });

    if (!termsDoc) {
      // Crear documento si no existe
      await prisma.termsDocument.create({
        data: {
          role: targetRole === Role.LAB_PHOTOGRAPHER ? Role.LAB : targetRole,
          version: activeVersion,
          contentMd: targetRole === Role.LAB || targetRole === Role.LAB_PHOTOGRAPHER
            ? (await import("@/lib/terms/labTerms")).LAB_TERMS_TEXT
            : (await import("@/lib/terms/photographerTermsExtended")).PHOTOGRAPHER_TERMS_TEXT,
          isActive: true,
        },
      });
    }

    // Crear aceptación
    const acceptance = await prisma.termsAcceptance.create({
      data: {
        userId: user.id,
        role: targetRole === Role.LAB_PHOTOGRAPHER ? Role.LAB : targetRole,
        termsDocumentId: termsDoc?.id || (await prisma.termsDocument.findFirst({
          where: {
            role: targetRole === Role.LAB_PHOTOGRAPHER ? Role.LAB : targetRole,
            version: activeVersion,
          },
        }))!.id,
        termsVersion: activeVersion,
        acceptedIp: acceptedIp || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        acceptedUserAgent: acceptedUserAgent || req.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({ success: true, acceptance });
  } catch (err: any) {
    console.error("Error aceptando términos:", err);
    return NextResponse.json(
      { error: "Error al aceptar términos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
