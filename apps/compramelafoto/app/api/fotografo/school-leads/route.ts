import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  buildEscolarLandingStatus,
  buildPhotographerSchoolLeadsWhere,
} from "@/lib/schools/photographer-escolar-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEADS = 200;

/**
 * GET /api/fotografo/school-leads
 * Estado de la landing escolar del fotógrafo logueado y las consultas de colegios que llegaron por ella.
 * Aislamiento: sólo SchoolLead con referredByUserId = usuario de la sesión.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const [profile, leads] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          publicPageHandler: true,
          isPublicPageEnabled: true,
          logoUrl: true,
          whatsapp: true,
          phone: true,
          companyName: true,
        },
      }),
      prisma.schoolLead.findMany({
        where: buildPhotographerSchoolLeadsWhere(user.id),
        orderBy: { createdAt: "desc" },
        take: MAX_LEADS,
        select: {
          id: true,
          schoolName: true,
          city: true,
          contactName: true,
          contactRole: true,
          email: true,
          whatsapp: true,
          approxStudents: true,
          message: true,
          notes: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      landing: buildEscolarLandingStatus(profile),
      profile: { publicPageHandler: profile.publicPageHandler, companyName: profile.companyName },
      leads,
    });
  } catch (err) {
    console.error("GET /api/fotografo/school-leads:", err);
    return NextResponse.json({ error: "Error listando consultas de colegios" }, { status: 500 });
  }
}
