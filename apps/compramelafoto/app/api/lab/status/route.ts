import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener estado del lab (aprobación, MP, T&C)
export async function GET(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener lab asociado
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        approvalStatus: true,
        isSuspended: true,
        mpConnectedAt: true,
        mpAccessToken: true,
        mpUserId: true,
        rejectedReason: true,
        suspendedReason: true,
      },
    });

    if (!lab) {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    // Verificar conexión MP
    const mpConnected = !!(lab.mpConnectedAt && lab.mpAccessToken && lab.mpUserId);

    // Verificar T&C
    let needsTermsAcceptance = false;
    let termsVersion: string | null = null;
    let termsAcceptedAt: Date | null = null;

    try {
      const activeTermsDoc = await prisma.termsDocument.findFirst({
        where: {
          role: Role.LAB,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeTermsDoc) {
        termsVersion = activeTermsDoc.version;

        const acceptance = await prisma.termsAcceptance.findFirst({
          where: {
            userId: user.id,
            role: Role.LAB,
            termsVersion: activeTermsDoc.version,
          },
          orderBy: { acceptedAt: "desc" },
        });

        if (!acceptance) {
          needsTermsAcceptance = true;
        } else {
          termsAcceptedAt = acceptance.acceptedAt;
        }
      }
    } catch (err) {
      console.warn("Error verificando términos:", err);
    }

    // Determinar si puede operar
    const canOperate =
      !lab.isSuspended &&
      mpConnected &&
      !needsTermsAcceptance;

    return NextResponse.json({
      labId: lab.id,
      userRole: user.role,
      approvalStatus: lab.approvalStatus,
      isSuspended: lab.isSuspended,
      canOperate,
      needsMpConnection: !mpConnected,
      needsTermsAcceptance,
      termsVersion,
      termsAcceptedAt,
      rejectedReason: lab.rejectedReason,
      suspendedReason: lab.suspendedReason,
    });
  } catch (err: any) {
    console.error("GET /api/lab/status ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo estado", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
