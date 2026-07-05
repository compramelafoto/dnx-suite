import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedSponsor } from "@/lib/organizer-landing-profile";
import {
  mapOrganizerSponsor,
  parseSortOrder,
  validateSponsorName,
  validateSponsorUrl,
} from "@/lib/organizer-landing-sponsors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/organizer/landing/sponsors/[sponsorId]
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ sponsorId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { sponsorId: sponsorIdParam } = await ctx.params;
    const sponsorId = Number(sponsorIdParam);
    if (!Number.isFinite(sponsorId) || sponsorId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const data: {
      name?: string;
      url?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (body?.name !== undefined) {
      const nameResult = validateSponsorName(body.name);
      if (!nameResult.ok) {
        return NextResponse.json({ error: nameResult.error }, { status: 400 });
      }
      data.name = nameResult.value;
    }

    if (body?.url !== undefined) {
      const urlResult = validateSponsorUrl(body.url);
      if (!urlResult.ok) {
        return NextResponse.json({ error: urlResult.error }, { status: 400 });
      }
      data.url = urlResult.value;
    }

    if (body?.sortOrder !== undefined) {
      data.sortOrder = parseSortOrder(body.sortOrder, 0);
    }

    if (body?.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    await requireOrganizerOwnedSponsor(user.id, sponsorId);

    const updated = await prisma.organizerLandingSponsor.update({
      where: { id: sponsorId },
      data,
    });

    return NextResponse.json({ sponsor: mapOrganizerSponsor(updated) });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("SPONSOR_NOT_FOUND")) {
      return NextResponse.json({ error: "Sponsor no encontrado" }, { status: 404 });
    }
    console.error("PATCH /api/organizer/landing/sponsors/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando sponsor", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizer/landing/sponsors/[sponsorId]
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ sponsorId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { sponsorId: sponsorIdParam } = await ctx.params;
    const sponsorId = Number(sponsorIdParam);
    if (!Number.isFinite(sponsorId) || sponsorId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await requireOrganizerOwnedSponsor(user.id, sponsorId);
    await prisma.organizerLandingSponsor.delete({ where: { id: sponsorId } });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("SPONSOR_NOT_FOUND")) {
      return NextResponse.json({ error: "Sponsor no encontrado" }, { status: 404 });
    }
    console.error("DELETE /api/organizer/landing/sponsors/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando sponsor", detail: msg },
      { status: 500 }
    );
  }
}
