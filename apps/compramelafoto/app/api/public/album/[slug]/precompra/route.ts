import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/album/[slug]/precompra
 * Catálogo público de pre-venta: álbum + productos (solo si preCompraCloseAt está definido y no pasó).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } | Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
    }

    const now = new Date();
    const album = await prisma.album.findFirst({
      where: {
        publicSlug: slug.trim(),
        deletedAt: null,
        preCompraCloseAt: { not: null, gte: now },
      },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        preCompraCloseAt: true,
        requireClientApproval: true,
        schoolId: true,
        user: { select: { id: true, name: true, logoUrl: true } },
        selectedLab: { select: { id: true, name: true, logoUrl: true } },
        school: {
          select: {
            id: true,
            name: true,
            courses: {
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { division: "asc" }],
              select: { id: true, name: true, division: true },
            },
          },
        },
        preCompraProducts: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            mockupUrl: true,
            minFotos: true,
            maxFotos: true,
            requiresDesign: true,
            suggestionText: true,
          },
        },
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado o pre-venta cerrada" }, { status: 404 });
    }

    const isSchool = !!album.schoolId && !!album.school;
    const courses = album.school?.courses ?? [];

    return NextResponse.json({
      album: {
        id: album.id,
        title: album.title,
        publicSlug: album.publicSlug,
        preCompraCloseAt: album.preCompraCloseAt,
        requireClientApproval: album.requireClientApproval,
        photographer: album.user,
        lab: album.selectedLab ?? null,
        schoolId: album.schoolId,
        isSchool,
        school: isSchool ? { id: album.school!.id, name: album.school!.name, courses } : null,
      },
      products: album.preCompraProducts,
    });
  } catch (e) {
    console.error("precompra catalog error:", e);
    return NextResponse.json({ error: "Error al cargar catálogo" }, { status: 500 });
  }
}
