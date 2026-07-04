import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

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
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const school = await prisma.school.create({
      data: {
        ownerId: user.id,
        name,
        contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
        contactPhone: body.contactPhone ? String(body.contactPhone).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        city: body.city ? String(body.city).trim() : null,
        province: body.province ? String(body.province).trim() : null,
        country: body.country ? String(body.country).trim() : null,
        latitude: typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null,
        longitude: typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null,
      },
    });

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
