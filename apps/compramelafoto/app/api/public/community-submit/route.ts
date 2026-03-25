import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugFromName, normalizeEmail, normalizeWhatsapp, normalizeInstagram } from "@/lib/community-submit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(["PHOTOGRAPHER_SERVICE", "EVENT_VENDOR"]),
  name: z.string().min(1, "Nombre obligatorio").max(200),
  categorySlugs: z.array(z.string().min(1)).min(1, "Seleccioná al menos un rubro"),
  province: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  whatsapp: z.string().min(1, "WhatsApp obligatorio").max(50),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
  tiktok: z.string().max(200).optional(),
  youtube: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  workReferences: z.array(z.string().max(500)).optional(),
  latitude: z.number().finite("Ubicación en mapa obligatoria"),
  longitude: z.number().finite("Ubicación en mapa obligatoria"),
});

export type CommunitySubmitBody = z.infer<typeof bodySchema>;

function trim(s: string | undefined): string {
  return (s ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join("; ");
      return NextResponse.json({ error: "Validación fallida", details: msg }, { status: 400 });
    }

    const body = parsed.data;
    const type = body.type;
    const emailNormalized = normalizeEmail(body.email || null);
    const whatsappNormalized = normalizeWhatsapp(body.whatsapp);

    if (!whatsappNormalized) {
      return NextResponse.json({ error: "WhatsApp inválido" }, { status: 400 });
    }

    const payload = {
      type,
      name: trim(body.name),
      categorySlugs: body.categorySlugs,
      province: trim(body.province) || null,
      city: trim(body.city) || null,
      whatsapp: trim(body.whatsapp),
      email: trim(body.email) || null,
      website: trim(body.website) || null,
      instagram: (normalizeInstagram(body.instagram) ?? trim(body.instagram)) || null,
      facebook: trim(body.facebook) || null,
      tiktok: trim(body.tiktok) || null,
      youtube: trim(body.youtube) || null,
      address: trim(body.address) || null,
      description: trim(body.description) || null,
      logoUrl: trim(body.logoUrl) || null,
      workReferences: body.type === "EVENT_VENDOR" ? (body.workReferences ?? []) : [],
      latitude: body.latitude,
      longitude: body.longitude,
    };

    const byEmail =
      emailNormalized
        ? await prisma.communityProfile.findUnique({
            where: { type_emailNormalized: { type, emailNormalized } },
          })
        : null;
    const byWhatsApp = await prisma.communityProfile.findUnique({
      where: { type_whatsappNormalized: { type, whatsappNormalized } },
    });

    if (byEmail && byWhatsApp && byEmail.id !== byWhatsApp.id) {
      await prisma.communitySubmission.create({
        data: {
          type,
          status: "CONFLICT",
          payload: payload as object,
          conflictProfileIds: [byEmail.id, byWhatsApp.id],
        },
      });
      return NextResponse.json({
        ok: false,
        conflict: true,
        message: "Tu email y WhatsApp coinciden con perfiles distintos. Contactanos para resolverlo.",
      });
    }

    const existing = byEmail ?? byWhatsApp;

    if (existing) {
      const updateData: Record<string, unknown> = {
        name: payload.name,
        province: payload.province ?? existing.province,
        city: payload.city ?? existing.city,
        whatsapp: payload.whatsapp,
        whatsappNormalized,
        status: "ACTIVE",
        website: payload.website ?? existing.website,
        instagram: payload.instagram ?? existing.instagram,
        facebook: payload.facebook ?? existing.facebook,
        tiktok: payload.tiktok ?? existing.tiktok,
        youtube: payload.youtube ?? existing.youtube,
        address: payload.address ?? existing.address,
        description: payload.description ?? existing.description,
        logoUrl: payload.logoUrl ?? existing.logoUrl,
        latitude: payload.latitude ?? existing.latitude ?? undefined,
        longitude: payload.longitude ?? existing.longitude ?? undefined,
      };
      if (emailNormalized) {
        updateData.email = payload.email ?? existing.email;
        updateData.emailNormalized = emailNormalized;
      }

      await prisma.communityProfile.update({
        where: { id: existing.id },
        data: updateData,
      });

      const categoryIds: number[] = [];
      for (const slug of payload.categorySlugs) {
        const cat = await prisma.communityCategory.findFirst({
          where: { type, slug },
        });
        if (cat) categoryIds.push(cat.id);
      }
      if (categoryIds.length > 0) {
        await prisma.communityProfileCategory.deleteMany({ where: { profileId: existing.id } });
        for (const categoryId of categoryIds) {
          await prisma.communityProfileCategory.create({
            data: { profileId: existing.id, categoryId },
          });
        }
      }

      if (type === "EVENT_VENDOR" && payload.workReferences.length > 0) {
        for (const label of payload.workReferences) {
          const trimmed = label.trim();
          if (!trimmed) continue;
          const exists = await prisma.communityWorkReference.findFirst({
            where: { profileId: existing.id, label: trimmed },
          });
          if (!exists) {
            await prisma.communityWorkReference.create({
              data: { profileId: existing.id, label: trimmed },
            });
          }
        }
      }

      await prisma.communitySubmission.create({
        data: {
          type,
          status: "APPLIED",
          payload: payload as object,
          matchedProfileId: existing.id,
        },
      });

      return NextResponse.json({
        ok: true,
        updated: true,
        profileId: existing.id,
        message: "Actualizamos tu ficha con los datos enviados.",
      });
    }

    const baseSlug = slugFromName(payload.name);
    let slug = baseSlug;
    let exists = await prisma.communityProfile.findUnique({
      where: { type_slug: { type, slug } },
    });
    if (exists) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const categoryIds: number[] = [];
    for (const slugCat of payload.categorySlugs) {
      const cat = await prisma.communityCategory.findFirst({
        where: { type, slug: slugCat },
      });
      if (cat) categoryIds.push(cat.id);
    }
    if (categoryIds.length === 0) {
      const other = await prisma.communityCategory.findFirst({
        where: { type, slug: "otro" },
      });
      if (other) categoryIds.push(other.id);
    }

    const created = await prisma.communityProfile.create({
      data: {
        type,
        status: "PENDING",
        name: payload.name,
        slug,
        province: payload.province ?? undefined,
        city: payload.city ?? undefined,
        email: payload.email,
        emailNormalized,
        whatsapp: payload.whatsapp,
        whatsappNormalized,
        website: payload.website ?? undefined,
        instagram: payload.instagram ?? undefined,
        facebook: payload.facebook ?? undefined,
        tiktok: payload.tiktok ?? undefined,
        youtube: payload.youtube ?? undefined,
        address: payload.address ?? undefined,
        description: payload.description ?? undefined,
        logoUrl: payload.logoUrl ?? undefined,
        latitude: payload.latitude ?? undefined,
        longitude: payload.longitude ?? undefined,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
    });

    if (type === "EVENT_VENDOR" && payload.workReferences.length > 0) {
      for (const label of payload.workReferences) {
        const trimmed = label.trim();
        if (trimmed) {
          await prisma.communityWorkReference.create({
            data: { profileId: created.id, label: trimmed },
          });
        }
      }
    }

    await prisma.communitySubmission.create({
      data: {
        type,
        status: "APPLIED",
        payload: payload as object,
        matchedProfileId: created.id,
      },
    });

    return NextResponse.json({
      ok: true,
      created: true,
      profileId: created.id,
      message: "Recibimos tus datos. En breve aparecerán en el directorio.",
    });
  } catch (err) {
    console.error("POST /api/public/community-submit ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al procesar el alta", detail: String((err as Error).message) },
      { status: 500 }
    );
  }
}
