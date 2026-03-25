import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { normalizeEmail, normalizeWhatsapp, normalizeInstagram } from "@/lib/community-submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional(),
  province: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  email: z.string().email().optional().or(z.literal("")),
  whatsapp: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
  tiktok: z.string().max(200).optional(),
  youtube: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  contactName: z.string().max(200).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  isFeatured: z.boolean().optional(),
  categorySlugs: z.array(z.string()).optional(),
  workReferences: z.array(z.string().max(500)).optional(),
  latitude: z.number().finite().optional().nullable(),
  longitude: z.number().finite().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const profile = await prisma.communityProfile.findUnique({
      where: { id },
      include: {
        categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        workReferences: { select: { id: true, label: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        ...profile,
        categorySlugs: profile.categories.map((c) => c.category.slug),
        workReferenceLabels: profile.workReferences.map((r) => r.label),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/community-profiles/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al obtener perfil", detail: String((err as Error).message) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const profile = await prisma.communityProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    const raw = await req.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validación fallida", details: msg },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const trim = (s: string | undefined) => (s ?? "").trim();
    const emailNorm = body.email !== undefined ? normalizeEmail(trim(body.email) || null) : null;
    const whatsappNorm = body.whatsapp !== undefined ? normalizeWhatsapp(body.whatsapp) : null;

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = trim(body.name);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.province !== undefined) updateData.province = trim(body.province) || null;
    if (body.city !== undefined) updateData.city = trim(body.city) || null;
    if (body.address !== undefined) updateData.address = trim(body.address) || null;
    if (body.email !== undefined) {
      updateData.email = trim(body.email) || null;
      updateData.emailNormalized = emailNorm;
    }
    if (body.whatsapp !== undefined) {
      updateData.whatsapp = trim(body.whatsapp) || null;
      updateData.whatsappNormalized = whatsappNorm;
    }
    if (body.website !== undefined) updateData.website = trim(body.website) || null;
    if (body.instagram !== undefined) updateData.instagram = (normalizeInstagram(body.instagram) ?? trim(body.instagram)) || null;
    if (body.facebook !== undefined) updateData.facebook = trim(body.facebook) || null;
    if (body.tiktok !== undefined) updateData.tiktok = trim(body.tiktok) || null;
    if (body.youtube !== undefined) updateData.youtube = trim(body.youtube) || null;
    if (body.description !== undefined) updateData.description = trim(body.description) || null;
    if (body.contactName !== undefined) updateData.contactName = trim(body.contactName) || null;
    if (body.logoUrl !== undefined) updateData.logoUrl = trim(body.logoUrl) || null;
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
    if (body.latitude !== undefined) updateData.latitude = body.latitude;
    if (body.longitude !== undefined) updateData.longitude = body.longitude;

    await prisma.communityProfile.update({
      where: { id },
      data: updateData,
    });

    if (body.categorySlugs !== undefined && body.categorySlugs.length >= 0) {
      const type = profile.type;
      const categoryIds: number[] = [];
      for (const slug of body.categorySlugs) {
        const cat = await prisma.communityCategory.findFirst({
          where: { type, slug },
        });
        if (cat) categoryIds.push(cat.id);
      }
      await prisma.communityProfileCategory.deleteMany({ where: { profileId: id } });
      for (const categoryId of categoryIds) {
        await prisma.communityProfileCategory.create({
          data: { profileId: id, categoryId },
        });
      }
    }

    if (profile.type === "EVENT_VENDOR" && body.workReferences !== undefined) {
      const labels = body.workReferences.map((l) => l.trim()).filter(Boolean);
      await prisma.communityWorkReference.deleteMany({ where: { profileId: id } });
      for (const label of labels) {
        await prisma.communityWorkReference.create({
          data: { profileId: id, label },
        });
      }
    }

    const updated = await prisma.communityProfile.findUnique({
      where: { id },
      include: {
        categories: { include: { category: { select: { name: true, slug: true } } } },
        workReferences: { select: { id: true, label: true } },
      },
    });

    return NextResponse.json({ profile: updated });
  } catch (err) {
    console.error("PATCH /api/admin/community-profiles/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al actualizar perfil", detail: String((err as Error).message) },
      { status: 500 }
    );
  }
}
