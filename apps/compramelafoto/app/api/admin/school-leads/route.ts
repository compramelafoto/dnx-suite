import { NextRequest, NextResponse } from "next/server";
import { Role, SchoolLeadStatus, type Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusValues = new Set<SchoolLeadStatus>([
  SchoolLeadStatus.NEW,
  SchoolLeadStatus.CONTACTED,
  SchoolLeadStatus.IN_PROGRESS,
  SchoolLeadStatus.CONVERTED,
  SchoolLeadStatus.DISCARDED,
]);

function parseStatus(value: string | null): SchoolLeadStatus | null {
  if (!value) return null;
  return statusValues.has(value as SchoolLeadStatus) ? (value as SchoolLeadStatus) : null;
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json({ error }, { status });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const statusFilter = parseStatus(searchParams.get("status"));
    const referredByUserIdParam = searchParams.get("referredByUserId");
    const referredByUserId =
      referredByUserIdParam && Number.isFinite(Number(referredByUserIdParam))
        ? Number(referredByUserIdParam)
        : null;

    const andFilters: Prisma.SchoolLeadWhereInput[] = [];
    if (statusFilter) andFilters.push({ status: statusFilter });
    if (referredByUserId != null) andFilters.push({ referredByUserId });

    if (q) {
      andFilters.push({
        OR: [
          { schoolName: { contains: q, mode: "insensitive" } },
          { contactName: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { whatsapp: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.SchoolLeadWhereInput =
      andFilters.length > 0 ? { AND: andFilters } : {};

    const leads = await prisma.schoolLead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
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
        status: true,
        referralCode: true,
        referredByUserId: true,
        referrerRole: true,
        createdAt: true,
        updatedAt: true,
        convertedAt: true,
        convertedSchoolId: true,
        notes: true,
        referredByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        convertedSchool: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error("GET /api/admin/school-leads:", err);
    return NextResponse.json({ error: "Error obteniendo solicitudes de escuelas." }, { status: 500 });
  }
}
