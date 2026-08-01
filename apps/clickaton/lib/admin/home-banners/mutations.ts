"use server";

import { revalidatePath } from "next/cache";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { HOME_BANNER_LINK_TYPES, type HomeBannerFormInput, type HomeBannerLinkType } from "./types";
import { isValidCoverImageRef } from "@/lib/admin/editions/validation";

export type HomeBannerActionState = {
  ok: boolean;
  errors?: Partial<Record<keyof HomeBannerFormInput, string>> & { form?: string };
  message?: string;
};

function revalidateBannerPaths() {
  revalidatePath(adminRoutes.homeBanners);
  revalidatePath("/");
}

function parseForm(formData: FormData): HomeBannerFormInput {
  const linkTypeRaw = String(formData.get("linkType") ?? "INTERNAL");
  const linkType = (HOME_BANNER_LINK_TYPES as readonly string[]).includes(linkTypeRaw)
    ? (linkTypeRaw as HomeBannerLinkType)
    : "INTERNAL";
  return {
    title: String(formData.get("title") ?? ""),
    eyebrow: String(formData.get("eyebrow") ?? ""),
    description: String(formData.get("description") ?? ""),
    ctaLabel: String(formData.get("ctaLabel") ?? "Ver más"),
    linkType,
    href: String(formData.get("href") ?? ""),
    editionId: String(formData.get("editionId") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? formData.get("coverImageUrl") ?? ""),
    imageUrlVertical: String(
      formData.get("imageUrlVertical") ?? formData.get("coverImageVerticalUrl") ?? "",
    ),
    sortOrder: String(formData.get("sortOrder") ?? "100"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}

function validate(input: HomeBannerFormInput): HomeBannerActionState {
  const errors: NonNullable<HomeBannerActionState["errors"]> = {};
  if (!input.title.trim()) errors.title = "El título es obligatorio.";
  if (!input.ctaLabel.trim()) errors.ctaLabel = "El texto del botón es obligatorio.";
  const sort = Number.parseInt(input.sortOrder, 10);
  if (!Number.isFinite(sort)) errors.sortOrder = "Orden inválido.";

  if (input.linkType === "EDITION") {
    if (!input.editionId.trim()) errors.editionId = "Elegí una edición.";
  } else if (input.linkType === "INTERNAL") {
    const href = input.href.trim();
    if (!href.startsWith("/") && !href.startsWith("#")) {
      errors.href = "Usá una ruta interna que empiece con / (ej. /comunidad).";
    }
  } else {
    try {
      const u = new URL(input.href.trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad");
    } catch {
      errors.href = "URL externa inválida (http/https).";
    }
  }

  if (input.imageUrl.trim() && !isValidCoverImageRef(input.imageUrl.trim())) {
    errors.imageUrl = "Imagen horizontal inválida.";
  }
  if (input.imageUrlVertical.trim() && !isValidCoverImageRef(input.imageUrlVertical.trim())) {
    errors.imageUrlVertical = "Imagen vertical inválida.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: "Revisá los campos marcados." };
  }
  return { ok: true };
}

function toDb(input: HomeBannerFormInput) {
  const sortOrder = Number.parseInt(input.sortOrder, 10) || 100;
  return {
    title: input.title.trim(),
    eyebrow: input.eyebrow.trim() || null,
    description: input.description.trim() || null,
    ctaLabel: input.ctaLabel.trim() || "Ver más",
    linkType: input.linkType,
    href: input.linkType === "EDITION" ? null : input.href.trim() || null,
    editionId: input.linkType === "EDITION" ? input.editionId.trim() || null : null,
    imageUrl: input.imageUrl.trim() || null,
    imageUrlVertical: input.imageUrlVertical.trim() || null,
    sortOrder,
    isActive: input.isActive,
    publishedAt: input.isActive ? new Date() : null,
  };
}

export async function createHomeBannerAction(
  _prev: HomeBannerActionState | undefined,
  formData: FormData,
): Promise<HomeBannerActionState> {
  await requireClickatonAdmin();
  const input = parseForm(formData);
  const validated = validate(input);
  if (!validated.ok) return validated;

  const result = await withClickatonDb(async () => {
    await prisma.clickatonHomeBanner.create({ data: toDb(input) });
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidateBannerPaths();
  return { ok: true, message: "Banner creado." };
}

export async function updateHomeBannerAction(
  _prev: HomeBannerActionState | undefined,
  formData: FormData,
): Promise<HomeBannerActionState> {
  await requireClickatonAdmin();
  const bannerId = String(formData.get("bannerId") ?? "").trim();
  if (!bannerId) return { ok: false, message: "Falta el identificador del banner." };
  const input = parseForm(formData);
  const validated = validate(input);
  if (!validated.ok) return validated;

  const result = await withClickatonDb(async () => {
    await prisma.clickatonHomeBanner.update({
      where: { id: bannerId },
      data: toDb(input),
    });
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidateBannerPaths();
  return { ok: true, message: "Banner actualizado." };
}

export async function deleteHomeBannerAction(formData: FormData) {
  await requireClickatonAdmin();
  const bannerId = String(formData.get("bannerId") ?? "").trim();
  if (!bannerId) return;
  await withClickatonDb(async () => {
    await prisma.clickatonHomeBanner.delete({ where: { id: bannerId } });
  });
  revalidateBannerPaths();
}

export type HomeBannerCarouselActionState = {
  ok: boolean;
  message?: string;
  errors?: { autoplaySeconds?: string; transitionMs?: string; form?: string };
};

export async function updateHomeBannerCarouselSettingsAction(
  _prev: HomeBannerCarouselActionState | undefined,
  formData: FormData,
): Promise<HomeBannerCarouselActionState> {
  await requireClickatonAdmin();
  const autoplayEnabled =
    formData.get("autoplayEnabled") === "on" || formData.get("autoplayEnabled") === "true";
  const secondsRaw = String(formData.get("autoplaySeconds") ?? "2").trim().replace(",", ".");
  const transitionRaw = String(formData.get("transitionMs") ?? "700").trim();
  const seconds = Number.parseFloat(secondsRaw);
  const transitionMs = Number.parseInt(transitionRaw, 10);

  const errors: NonNullable<HomeBannerCarouselActionState["errors"]> = {};
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 30) {
    errors.autoplaySeconds = "Usá entre 1 y 30 segundos.";
  }
  if (!Number.isFinite(transitionMs) || transitionMs < 200 || transitionMs > 2000) {
    errors.transitionMs = "Usá entre 200 y 2000 ms.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: "Revisá los campos del carousel." };
  }

  const autoplayMs = Math.round(seconds * 1000);
  const result = await withClickatonDb(async () => {
    await prisma.clickatonHomeBannerSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        autoplayEnabled,
        autoplayMs,
        transitionMs,
      },
      update: { autoplayEnabled, autoplayMs, transitionMs },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidateBannerPaths();
  return {
    ok: true,
    message: `Carousel guardado (${autoplayEnabled ? `${seconds}s` : "sin autoplay"}, transición ${transitionMs}ms).`,
  };
}

export async function moveHomeBannerAction(formData: FormData) {
  await requireClickatonAdmin();
  const bannerId = String(formData.get("bannerId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "") === "up" ? "up" : "down";
  if (!bannerId) return;

  await withClickatonDb(async () => {
    const all = await prisma.clickatonHomeBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const idx = all.findIndex((b) => b.id === bannerId);
    if (idx < 0) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= all.length) return;
    const ordered = [...all];
    const [moved] = ordered.splice(idx, 1);
    if (!moved) return;
    ordered.splice(swapWith, 0, moved);
    // Renumerar para que ↑/↓ funcione aunque varios compartan el mismo sortOrder.
    await prisma.$transaction(
      ordered.map((row, i) =>
        prisma.clickatonHomeBanner.update({
          where: { id: row.id },
          data: { sortOrder: (i + 1) * 10 },
        }),
      ),
    );
  });
  revalidateBannerPaths();
}
