import { NextRequest, NextResponse } from "next/server";
import { Role, StudentEnrollmentStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  encodeCourseSlotKey,
  formatCourseSlotLabel,
} from "@/lib/school-roster/course-slot-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShiftGroup = {
  shift: string;
  slots: Array<{ courseKey: string; courseName: string; division: string; label: string; count: number }>;
};

type LevelGroup = {
  level: string;
  shifts: ShiftGroup[];
};

function sortLocale(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const schoolId = parseInt(id, 10);
    if (!Number.isFinite(schoolId) || schoolId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { ownerId: true },
    });
    if (!school || school.ownerId !== user.id) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const ayParam = searchParams.get("academicYearId");
    let ayId: number | null = null;
    if (ayParam != null && String(ayParam).trim() !== "") {
      const p = parseInt(String(ayParam), 10);
      if (Number.isInteger(p) && p > 0) ayId = p;
    }

    let academicYear =
      ayId != null
        ? await prisma.academicYear.findFirst({
            where: { id: ayId, schoolId },
            select: { id: true, label: true, isCurrent: true },
          })
        : null;

    if (!academicYear) {
      academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        orderBy: { id: "asc" },
        select: { id: true, label: true, isCurrent: true },
      });
    }
    if (!academicYear) {
      academicYear = await prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: { id: "desc" },
        select: { id: true, label: true, isCurrent: true },
      });
    }

    if (!academicYear) {
      return NextResponse.json({
        academicYear: null,
        groups: [] as LevelGroup[],
        totalEnrollments: 0,
        academicYears: await prisma.academicYear.findMany({
          where: { schoolId },
          orderBy: [{ isCurrent: "desc" }, { id: "desc" }],
          select: { id: true, label: true, isCurrent: true },
        }),
      });
    }

    const grouped = await prisma.studentEnrollment.groupBy({
      by: ["level", "shift", "courseName", "division"],
      where: {
        schoolId,
        academicYearId: academicYear.id,
        status: StudentEnrollmentStatus.ACTIVE,
      },
      _count: { id: true },
    });

    type Row = {
      level: string;
      shift: string;
      courseName: string;
      division: string;
      count: number;
      courseKey: string;
      label: string;
    };

    const rows: Row[] = grouped.map((g) => ({
      level: String(g.level ?? "").trim(),
      shift: String(g.shift ?? "").trim(),
      courseName: String(g.courseName ?? "").trim(),
      division: String(g.division ?? "").trim(),
      count: g._count.id,
      courseKey: encodeCourseSlotKey(g.level, g.shift, g.courseName, g.division),
      label: formatCourseSlotLabel(g.courseName, g.division),
    }));

    const levelMap = new Map<string, Map<string, Row[]>>();
    let totalEnrollments = 0;
    for (const r of rows) {
      totalEnrollments += r.count;
      if (!levelMap.has(r.level)) levelMap.set(r.level, new Map());
      const sm = levelMap.get(r.level)!;
      if (!sm.has(r.shift)) sm.set(r.shift, []);
      sm.get(r.shift)!.push(r);
    }

    const groups: LevelGroup[] = [...levelMap.keys()].sort(sortLocale).map((level) => {
      const sm = levelMap.get(level)!;
      const shifts: ShiftGroup[] = [...sm.keys()].sort(sortLocale).map((shift) => {
        const slotRows = sm.get(shift)!;
        slotRows.sort((a, b) => {
          const l1 = sortLocale(a.courseName, b.courseName);
          if (l1 !== 0) return l1;
          return sortLocale(a.division, b.division);
        });
        return {
          shift,
          slots: slotRows.map((s) => ({
            courseKey: s.courseKey,
            courseName: s.courseName,
            division: s.division,
            label: s.label,
            count: s.count,
          })),
        };
      });
      return { level, shifts };
    });

    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: [{ isCurrent: "desc" }, { id: "desc" }],
      select: { id: true, label: true, isCurrent: true },
    });

    return NextResponse.json({
      academicYear,
      groups,
      totalEnrollments,
      academicYears,
    });
  } catch (e) {
    console.error("GET /api/fotografo/schools/[id]/enrollment-course-slots:", e);
    return NextResponse.json({ error: "Error obteniendo cursos" }, { status: 500 });
  }
}
