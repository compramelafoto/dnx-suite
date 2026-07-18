import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const activeStudents = await prisma.schoolStudent.findMany({
      where: {
        schoolId,
        isActive: true,
      },
      select: { id: true },
    });
    const studentIds = activeStudents.map((student) => student.id);
    if (studentIds.length === 0) {
      return NextResponse.json({
        ok: true,
        affected: {
          totalStudents: 0,
          removedStudents: 0,
          keptStudentsWithOrders: 0,
        },
      });
    }

    const [directOrderStudents, rosterEntriesWithOrders] = await Promise.all([
      prisma.preCompraOrder.findMany({
        where: {
          studentId: { in: studentIds },
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.albumStudentRosterEntry.findMany({
        where: {
          studentId: { in: studentIds },
          preCompraOrders: {
            some: {},
          },
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
    ]);

    const lockedStudentIds = new Set<number>();
    for (const row of directOrderStudents) {
      if (row.studentId != null) lockedStudentIds.add(row.studentId);
    }
    for (const row of rosterEntriesWithOrders) {
      lockedStudentIds.add(row.studentId);
    }

    const deletableStudentIds = studentIds.filter((id) => !lockedStudentIds.has(id));
    if (deletableStudentIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.albumStudentRosterEntry.updateMany({
          where: {
            studentId: { in: deletableStudentIds },
          },
          data: { isActive: false },
        });
        await tx.studentEnrollment.updateMany({
          where: {
            studentId: { in: deletableStudentIds },
          },
          data: { status: "INACTIVE" },
        });
        await tx.student.updateMany({
          where: {
            id: { in: deletableStudentIds },
          },
          data: { isActive: false },
        });
      });
    }

    console.log("[school_organizer] students_reset", {
      schoolId,
      organizerUserId: access.user.id,
      totalStudents: studentIds.length,
      removedStudents: deletableStudentIds.length,
      keptStudentsWithOrders: lockedStudentIds.size,
    });

    return NextResponse.json({
      ok: true,
      affected: {
        totalStudents: studentIds.length,
        removedStudents: deletableStudentIds.length,
        keptStudentsWithOrders: lockedStudentIds.size,
      },
    });
  } catch (err) {
    console.error("POST /api/school-organizer/schools/[schoolId]/students/reset:", err);
    return NextResponse.json({ error: "Error reiniciando listado de alumnos" }, { status: 500 });
  }
}
