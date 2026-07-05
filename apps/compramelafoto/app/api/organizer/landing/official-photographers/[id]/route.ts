import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedOfficialPhotographer } from "@/lib/organizer-landing-profile";
import {
  loadOfficialPhotographerEventCounts,
  mapOrganizerOfficialPhotographerRow,
  parseSortOrder,
} from "@/lib/organizer-landing-official-photographers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const photographerInclude = {
  photographer: {
    select: {
      id: true,
      name: true,
      companyName: true,
      city: true,
      province: true,
      logoUrl: true,
      publicPageHandler: true,
      isPublicPageEnabled: true,
      role: true,
      isBlocked: true,
    },
  },
} as const;

/**
 * PATCH /api/organizer/landing/official-photographers/[id]
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER, Role.SCHOOL_ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const data: { sortOrder?: number; isActive?: boolean } = {};

    if (body?.sortOrder !== undefined) {
      data.sortOrder = parseSortOrder(body.sortOrder, 0);
    }
    if (body?.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    await requireOrganizerOwnedOfficialPhotographer(user.id, id);

    const updated = await prisma.organizerOfficialPhotographer.update({
      where: { id },
      data,
      include: photographerInclude,
    });

    const eventCounts = await loadOfficialPhotographerEventCounts(user.id);
    return NextResponse.json({
      item: mapOrganizerOfficialPhotographerRow(
        updated,
        eventCounts.get(updated.photographerUserId) ?? 0
      ),
    });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("OFFICIAL_PHOTOGRAPHER_NOT_FOUND")) {
      return NextResponse.json({ error: "Fotógrafo oficial no encontrado" }, { status: 404 });
    }
    console.error("PATCH official-photographers/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando fotógrafo oficial", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizer/landing/official-photographers/[id]
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER, Role.SCHOOL_ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id: idParam } = await ctx.params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await requireOrganizerOwnedOfficialPhotographer(user.id, id);
    await prisma.organizerOfficialPhotographer.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("OFFICIAL_PHOTOGRAPHER_NOT_FOUND")) {
      return NextResponse.json({ error: "Fotógrafo oficial no encontrado" }, { status: 404 });
    }
    console.error("DELETE official-photographers/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando fotógrafo oficial", detail: msg },
      { status: 500 }
    );
  }
}
