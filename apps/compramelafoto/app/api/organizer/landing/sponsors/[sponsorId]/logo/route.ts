import { randomUUID } from "crypto";
import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  ORGANIZER_LANDING_SPONSOR_LOGO_MAX_BYTES,
  extensionForImageMime,
  requireOrganizerOwnedSponsor,
  validateLandingImageFile,
} from "@/lib/organizer-landing-profile";
import { mapOrganizerSponsor } from "@/lib/organizer-landing-sponsors";
import { generateR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/landing/sponsors/[sponsorId]/logo
 */
export async function POST(
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    const validation = validateLandingImageFile(file, ORGANIZER_LANDING_SPONSOR_LOGO_MAX_BYTES);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { profile } = await requireOrganizerOwnedSponsor(user.id, sponsorId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionForImageMime(validation.contentType);
    const key = generateR2Key(
      `sponsor_${sponsorId}_${randomUUID()}.${ext}`,
      `organizer-landings/${profile.userId}/sponsors`
    );

    await uploadToR2(buffer, key, validation.contentType, {
      type: "organizer_landing_sponsor_logo",
      userId: String(user.id),
      sponsorId: String(sponsorId),
    });

    const updated = await prisma.organizerLandingSponsor.update({
      where: { id: sponsorId },
      data: { logoR2Key: key },
    });

    return NextResponse.json({
      sponsor: mapOrganizerSponsor(updated),
      logoUrl: getR2PublicUrl(key),
    });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("SPONSOR_NOT_FOUND")) {
      return NextResponse.json({ error: "Sponsor no encontrado" }, { status: 404 });
    }
    console.error("POST .../sponsors/[id]/logo ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo logo del sponsor", detail: msg },
      { status: 500 }
    );
  }
}
