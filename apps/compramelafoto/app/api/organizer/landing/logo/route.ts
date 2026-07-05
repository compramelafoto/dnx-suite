import { randomUUID } from "crypto";
import { Role } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { mapOrganizerLandingProfile } from "@/lib/organizer-landing-api-map";
import {
  ORGANIZER_LANDING_LOGO_MAX_BYTES,
  ensureOrganizerPublicProfile,
  extensionForImageMime,
  validateLandingImageFile,
} from "@/lib/organizer-landing-profile";
import { generateR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/landing/logo
 */
export async function POST(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    const validation = validateLandingImageFile(file, ORGANIZER_LANDING_LOGO_MAX_BYTES);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await ensureOrganizerPublicProfile(user.id);

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionForImageMime(validation.contentType);
    const key = generateR2Key(
      `logo_${randomUUID()}.${ext}`,
      `organizer-landings/${user.id}`
    );

    await uploadToR2(buffer, key, validation.contentType, {
      type: "organizer_landing_logo",
      userId: String(user.id),
    });

    const updated = await prisma.organizerPublicProfile.update({
      where: { userId: user.id },
      data: { logoR2Key: key },
    });

    return NextResponse.json({
      logoR2Key: key,
      logoUrl: getR2PublicUrl(key),
      profile: mapOrganizerLandingProfile(updated),
    });
  } catch (err: unknown) {
    console.error("POST /api/organizer/landing/logo ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo logo", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
