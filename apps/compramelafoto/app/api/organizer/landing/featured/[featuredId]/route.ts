import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedProfile } from "@/lib/organizer-landing-profile";
import { mapFeaturedGalleryRow, organizerFeaturedGalleryInclude } from "@/lib/organizer-landing-featured";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const featuredInclude = organizerFeaturedGalleryInclude;

async function requireOwnedFeatured(userId: number, featuredId: number) {
  const profile = await requireOrganizerOwnedProfile(userId);
  const row = await prisma.organizerFeaturedGallery.findFirst({
    where: { id: featuredId, profileId: profile.id },
    include: featuredInclude,
  });
  if (!row) throw new Error("FEATURED_NOT_FOUND");
  return row;
}

/**
 * PATCH /api/organizer/landing/featured/[featuredId]
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ featuredId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { featuredId: param } = await ctx.params;
    const featuredId = Number(param);
    if (!Number.isFinite(featuredId) || featuredId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const data: { sortOrder?: number; isActive?: boolean } = {};
    if (body?.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (Number.isFinite(n)) data.sortOrder = Math.max(0, Math.floor(n));
    }
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    await requireOwnedFeatured(user.id, featuredId);
    const updated = await prisma.organizerFeaturedGallery.update({
      where: { id: featuredId },
      data,
      include: featuredInclude,
    });

    return NextResponse.json({ item: mapFeaturedGalleryRow(updated) });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("FEATURED_NOT_FOUND")) {
      return NextResponse.json({ error: "Destacado no encontrado" }, { status: 404 });
    }
    console.error("PATCH featured/[id] ERROR >>>", err);
    return NextResponse.json({ error: "Error actualizando destacado", detail: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/organizer/landing/featured/[featuredId]
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ featuredId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { featuredId: param } = await ctx.params;
    const featuredId = Number(param);
    if (!Number.isFinite(featuredId) || featuredId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await requireOwnedFeatured(user.id, featuredId);
    await prisma.organizerFeaturedGallery.delete({ where: { id: featuredId } });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("FEATURED_NOT_FOUND")) {
      return NextResponse.json({ error: "Destacado no encontrado" }, { status: 404 });
    }
    console.error("DELETE featured/[id] ERROR >>>", err);
    return NextResponse.json({ error: "Error eliminando destacado", detail: msg }, { status: 500 });
  }
}
