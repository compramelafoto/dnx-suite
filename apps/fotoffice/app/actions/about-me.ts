"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { parseAboutMe } from "@/lib/spotlight/about";
import {
  allowedFeaturedUrls,
  appendFeaturedPhoto,
  featuredPhotoPrefix,
  memberForAboutMe,
  saveAboutMe,
} from "@/lib/spotlight/about-store";
import { IMAGE_PRESETS } from "@/lib/images/presets";
import { verifyUploadedImage } from "@/lib/images/r2-presign";
import { deleteFotofficeR2Object, getFotofficeR2PublicUrl } from "@/lib/images/r2-client";

export type AboutMeState = { error: string | null; field?: string; ok: string | null };

/** Guarda «Más sobre mí». Todo opcional; sólo se valida el largo, el link y las fotos. */
export async function saveAboutMeAction(_prev: AboutMeState, formData: FormData): Promise<AboutMeState> {
  const user = await requireAuth();
  const socio = await memberForAboutMe(user.id);
  if (!socio) return { error: "No encontramos tu ficha de socio.", ok: null };

  const fotos = formData.getAll("featuredPhotoUrls").map(String);
  const permitidas = await allowedFeaturedUrls({
    workspaceId: socio.workspaceId,
    memberId: socio.id,
    candidates: fotos,
  });

  const parsed = parseAboutMe({
    answers: Object.fromEntries(formData.entries()),
    proudPhotoUrl: formData.get("proudPhotoUrl"),
    whatsappOptIn: formData.get("whatsappOptIn") === "on",
    spotlightNotice: formData.get("spotlightNotice") === "on",
    featuredPhotoUrls: fotos,
    allowedPhotoUrls: permitidas,
  });
  if (!parsed.ok) return { error: parsed.error, field: parsed.field, ok: null };

  await saveAboutMe({ memberId: socio.id, workspaceId: socio.workspaceId, value: parsed.value });
  revalidatePath("/portal");
  revalidatePath("/portal/perfil/sobre-mi");
  return {
    error: null,
    ok: "Listo, guardamos tu «Más sobre mí». Gracias por contarnos de vos.",
  };
}

export type FeaturedPhotoResult = { ok: true; urls: string[] } | { ok: false; error: string };

/**
 * Registra una foto subida directo a R2 para la placa. Mismo esquema que el portfolio: la key
 * tiene que caer en el espacio de ESTE socio, y se verifica el archivo ya subido.
 */
export async function registerFeaturedPhotoAction(input: { key: string }): Promise<FeaturedPhotoResult> {
  const user = await requireAuth();
  const socio = await memberForAboutMe(user.id);
  if (!socio) return { ok: false, error: "No encontramos tu ficha de socio." };

  if (!input.key.startsWith(`${featuredPhotoPrefix(socio.workspaceId, socio.id)}/`)) {
    return { ok: false, error: "No pudimos verificar el archivo subido." };
  }
  const preset = IMAGE_PRESETS.memberPortfolioPhoto;
  const verificacion = await verifyUploadedImage({
    key: input.key,
    maxFileSizeBytes: preset.maxFileSizeBytes,
    acceptedFormats: preset.acceptedFormats,
  });
  if (!verificacion.ok) {
    await deleteFotofficeR2Object(input.key);
    return { ok: false, error: verificacion.error };
  }

  const r = await appendFeaturedPhoto({
    memberId: socio.id,
    workspaceId: socio.workspaceId,
    url: getFotofficeR2PublicUrl(input.key),
  });
  if (!r.ok) {
    await deleteFotofficeR2Object(input.key);
    return r;
  }
  revalidatePath("/portal/perfil/sobre-mi");
  return r;
}
