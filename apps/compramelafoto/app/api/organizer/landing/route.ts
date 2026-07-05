import { Prisma, Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { mapOrganizerLandingProfile } from "@/lib/organizer-landing-api-map";
import {
  buildDefaultSlugFromUser,
  validateOrganizerLandingPatch,
} from "@/lib/organizer-landing-fields";
import { defaultOrganizerLandingModules } from "@/lib/organizer-landing-modules";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/landing
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const profile = await prisma.organizerPublicProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, city: true, province: true },
      });
      if (!dbUser) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }
      return NextResponse.json({
        profile: null,
        defaults: {
          publicSlug: buildDefaultSlugFromUser(dbUser),
          displayName: dbUser.name?.trim() || "Mi organización",
          city: dbUser.city,
          zone: dbUser.province,
          modulesJson: defaultOrganizerLandingModules(),
          isPublished: false,
        },
      });
    }

    return NextResponse.json({ profile: mapOrganizerLandingProfile(profile) });
  } catch (err: unknown) {
    console.error("GET /api/organizer/landing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo la página pública", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizer/landing
 */
export async function PATCH(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const existing = await prisma.organizerPublicProfile.findUnique({
      where: { userId: user.id },
    });

    const validation = await validateOrganizerLandingPatch(body, {
      excludeUserId: user.id,
      excludeProfileId: existing?.id,
      currentSlug: existing?.publicSlug,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data } = validation;

    const profile = existing
      ? await prisma.organizerPublicProfile.update({
          where: { userId: user.id },
          data: {
            publicSlug: data.publicSlug,
            isPublished: data.isPublished,
            displayName: data.displayName,
            tagline: data.tagline,
            description: data.description,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            city: data.city,
            zone: data.zone,
            website: data.website,
            instagram: data.instagram,
            whatsapp: data.whatsapp,
            publicEmail: data.publicEmail,
            modulesJson: data.modulesJson as Prisma.InputJsonValue,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
          },
        })
      : await prisma.organizerPublicProfile.create({
          data: {
            userId: user.id,
            publicSlug: data.publicSlug,
            isPublished: data.isPublished,
            displayName: data.displayName,
            tagline: data.tagline,
            description: data.description,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            city: data.city,
            zone: data.zone,
            website: data.website,
            instagram: data.instagram,
            whatsapp: data.whatsapp,
            publicEmail: data.publicEmail,
            modulesJson: data.modulesJson as Prisma.InputJsonValue,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
          },
        });

    return NextResponse.json({ profile: mapOrganizerLandingProfile(profile) });
  } catch (err: unknown) {
    console.error("PATCH /api/organizer/landing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando la página pública", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
