import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { createSchoolForOwner } from "@/lib/schools/school-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Listar escuelas del fotógrafo */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const schools = await prisma.school.findMany({
      where: { ownerId: user.id },
      include: {
        courses: { select: { id: true } },
        albums: { where: { deletedAt: null }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = schools.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      logoUrl: s.logoUrl,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      notes: s.notes,
      address: s.address,
      city: s.city,
      province: s.province,
      country: s.country,
      latitude: s.latitude,
      longitude: s.longitude,
      createdAt: s.createdAt,
      coursesCount: s.courses.length,
      albumsCount: s.albums.length,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET /api/fotografo/schools:", err);
    return NextResponse.json({ error: "Error listando escuelas" }, { status: 500 });
  }
}

/** POST: Crear escuela */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const created = await createSchoolForOwner(user.id, body);
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status });
    }
    const school = created.school;

    return NextResponse.json(school);
  } catch (err: any) {
    console.error("POST /api/fotografo/schools:", err);
    const detail = err?.message ?? String(err);
    return NextResponse.json(
      { error: "Error creando escuela", detail },
      { status: 500 }
    );
  }
}
