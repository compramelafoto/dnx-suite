"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@repo/db";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalHttpUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => !v || /^https?:\/\//i.test(v), "URL inválida (usá https://…)");

const optionalHandleOrUrl = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const profileSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  bio: optionalText(600),
  city: optionalText(120),
  province: optionalText(120),
  website: optionalHttpUrl,
  instagram: optionalHandleOrUrl,
  facebook: optionalHandleOrUrl,
  tiktok: optionalHandleOrUrl,
  whatsapp: optionalText(40),
  logoUrl: optionalText(800),
});

export type ProfileFormState = { error: string | null; ok?: boolean };

export async function updateMyEditorialProfileAction(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const access = await requireInfoSpotRedaccionAccess();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio")?.toString() ?? "",
    city: formData.get("city")?.toString() ?? "",
    province: formData.get("province")?.toString() ?? "",
    website: formData.get("website")?.toString() ?? "",
    instagram: formData.get("instagram")?.toString() ?? "",
    facebook: formData.get("facebook")?.toString() ?? "",
    tiktok: formData.get("tiktok")?.toString() ?? "",
    whatsapp: formData.get("whatsapp")?.toString() ?? "",
    logoUrl: formData.get("logoUrl")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.user.update({
      where: { id: access.user.id },
      data: {
        name: parsed.data.name,
        bio: parsed.data.bio,
        city: parsed.data.city,
        province: parsed.data.province,
        website: parsed.data.website,
        instagram: parsed.data.instagram,
        facebook: parsed.data.facebook,
        tiktok: parsed.data.tiktok,
        whatsapp: parsed.data.whatsapp,
        ...(parsed.data.logoUrl ? { logoUrl: parsed.data.logoUrl } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[infospot/profile] update failed:", message);
    return { error: "No se pudo guardar el perfil. Intentá de nuevo." };
  }

  revalidatePath("/redaccion");
  revalidatePath("/redaccion/perfil");
  revalidatePath(`/autores/${access.user.id}`);
  revalidatePath("/noticias");
  redirect("/redaccion/perfil?ok=1");
}
