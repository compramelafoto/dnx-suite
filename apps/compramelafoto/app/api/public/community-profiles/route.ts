import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";

export const dynamic = "force-dynamic";

/**
 * Listado público de perfiles de Comunidad (Para fotógrafos o Proveedores).
 * Solo devuelve perfiles ACTIVE con logo y nombre (mismos criterios que directorio fotógrafos/labs).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR" | null;
    if (!type || !["PHOTOGRAPHER_SERVICE", "EVENT_VENDOR"].includes(type)) {
      return NextResponse.json({ error: "type debe ser PHOTOGRAPHER_SERVICE o EVENT_VENDOR" }, { status: 400 });
    }

    const province = searchParams.get("province")?.trim();
    const city = searchParams.get("city")?.trim();
    const categorySlug = searchParams.get("category")?.trim();
    const featuredOnly = searchParams.get("featured") === "true";

    const where: Record<string, unknown> = {
      type,
      status: "ACTIVE",
      AND: [{ logoUrl: { not: null } }, { logoUrl: { not: "" } }],
    };
    if (province) where.province = { equals: province, mode: "insensitive" };
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (featuredOnly) where.isFeatured = true;
    if (categorySlug) {
      where.categories = {
        some: { category: { slug: categorySlug, isActive: true } },
      };
    }

    const profiles = await prisma.communityProfile.findMany({
      where: where as object,
      include: {
        categories: { include: { category: { select: { name: true, slug: true } } } },
        workReferences: { select: { label: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });

    const list = profiles.map((p) => {
      const rawLogo = p.logoUrl?.trim();
      const logoUrl =
        rawLogo && rawLogo.length > 0
          ? rawLogo.startsWith("http")
            ? rawLogo
            : getR2PublicUrl(rawLogo.replace(/^\//, ""))
          : null;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description ?? null,
        province: p.province ?? null,
        city: p.city ?? null,
        address: p.address ?? null,
        email: p.email ?? null,
        whatsapp: p.whatsapp ?? null,
        website: p.website ?? null,
        instagram: p.instagram ?? null,
        facebook: p.facebook ?? null,
        logoUrl,
        isFeatured: p.isFeatured,
        categories: p.categories.map((c) => ({ name: c.category.name, slug: c.category.slug })),
        workReferences: p.workReferences.map((r) => r.label),
      };
    });

    return NextResponse.json({ profiles: list });
  } catch (err) {
    console.error("GET /api/public/community-profiles ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al listar perfiles", detail: String((err as Error).message) },
      { status: 500 }
    );
  }
}
