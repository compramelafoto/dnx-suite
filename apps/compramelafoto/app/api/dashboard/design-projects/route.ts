import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function schoolCourseLabel(course: { name: string; division: string | null } | null): string | null {
  if (!course) return null;
  const parts = [course.name?.trim(), course.division?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** GET: listar proyectos de diseño del fotógrafo dueño del álbum */
export async function GET() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.designProject.findMany({
    where: {
      orderItem: {
        order: {
          album: {
            userId: user.id,
            schoolId: { not: null },
          },
        },
      },
    },
    select: {
      id: true,
      status: true,
      orderItemId: true,
      createdAt: true,
      updatedAt: true,
      orderItem: {
        select: {
          order: {
            select: {
              studentFirstName: true,
              studentLastName: true,
              schoolCourseId: true,
              album: {
                select: {
                  id: true,
                  title: true,
                  publicSlug: true,
                  schoolId: true,
                  school: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              schoolCourse: {
                select: {
                  id: true,
                  name: true,
                  division: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const projects = rows.map((p) => {
    const order = p.orderItem.order;
    const album = order.album;
    const school = album.school;
    const course = order.schoolCourse;

    return {
      id: p.id,
      status: p.status,
      orderItemId: p.orderItemId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      albumId: album.id,
      albumTitle: album.title,
      albumSlug: album.publicSlug,
      schoolId: school?.id ?? album.schoolId ?? null,
      schoolName: school?.name ?? null,
      schoolCourseId: order.schoolCourseId ?? course?.id ?? null,
      schoolCourseName: schoolCourseLabel(course),
      studentFirstName: order.studentFirstName,
      studentLastName: order.studentLastName,
    };
  });

  return NextResponse.json({ projects });
}
