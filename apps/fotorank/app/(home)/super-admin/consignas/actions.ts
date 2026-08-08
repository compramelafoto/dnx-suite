"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  approve,
  archive,
  createItem,
  duplicateItem,
  importApply,
  importPreviewFromPayload,
  parseTagsInput,
  reject,
  restore,
  slugifyLabel,
  submitForReview,
  updateItem,
  type PhotoPromptDifficulty,
  type PhotoPromptInspirationType,
} from "@repo/photo-prompt-library";
import { requireAuth } from "../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../lib/fotorank/access/super-admin";
import { routes } from "../../../lib/routes";

async function requireSuperAdmin() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }
  return user;
}

function isNextRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e;
}

function revalidateLibrary(id?: string) {
  revalidatePath(routes.superAdmin.consignas());
  revalidatePath(routes.superAdmin.import());
  if (id) revalidatePath(routes.superAdmin.consigna(id));
}

function readFormString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function readOptionalInspirationType(
  formData: FormData,
): PhotoPromptInspirationType | null {
  const v = readFormString(formData, "inspirationType").trim();
  return v ? (v as PhotoPromptInspirationType) : null;
}

function readDifficulty(formData: FormData): PhotoPromptDifficulty {
  const v = readFormString(formData, "difficulty").trim() || "MEDIUM";
  return v as PhotoPromptDifficulty;
}

async function resolveThemeId(formData: FormData): Promise<string> {
  const themeId = readFormString(formData, "themeId").trim();
  const themeName = readFormString(formData, "themeName").trim();
  if (themeId) return themeId;
  if (!themeName) {
    throw new Error("Seleccioná o creá una temática.");
  }
  const slug = slugifyLabel(themeName);
  const existing = await prisma.photoPromptTheme.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: themeName, mode: "insensitive" } }],
    },
  });
  if (existing) return existing.id;
  const created = await prisma.photoPromptTheme.create({
    data: { name: themeName, slug },
  });
  return created.id;
}

async function resolveSubthemeId(
  themeId: string,
  formData: FormData,
): Promise<string | null> {
  const subthemeId = readFormString(formData, "subthemeId").trim() || null;
  const subthemeName = readFormString(formData, "subthemeName").trim();
  if (subthemeId) return subthemeId;
  if (!subthemeName) return null;
  const slug = slugifyLabel(subthemeName);
  const existing = await prisma.photoPromptSubtheme.findFirst({
    where: {
      themeId,
      OR: [{ slug }, { name: { equals: subthemeName, mode: "insensitive" } }],
    },
  });
  if (existing) return existing.id;
  const created = await prisma.photoPromptSubtheme.create({
    data: { themeId, name: subthemeName, slug },
  });
  return created.id;
}

export async function createConsignaAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    const themeId = await resolveThemeId(formData);
    const subthemeId = await resolveSubthemeId(themeId, formData);
    const created = await createItem(
      {
        title: readFormString(formData, "title"),
        description: readFormString(formData, "description"),
        themeId,
        subthemeId,
        inspirationType: readOptionalInspirationType(formData),
        inspirationLabel: readFormString(formData, "inspirationLabel") || null,
        inspirationNotes: readFormString(formData, "inspirationNotes") || null,
        tags: parseTagsInput(readFormString(formData, "tags")),
        difficulty: readDifficulty(formData),
        language: readFormString(formData, "language") || "es",
        universal: formData.get("universal") === "on" || formData.get("universal") === "1",
        createdByUserId: user.id,
      },
      { prisma },
    );
    revalidateLibrary(created.id);
    redirect(routes.superAdmin.consigna(created.id));
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error al crear";
    redirect(`${routes.superAdmin.consignas()}/nuevo?error=${encodeURIComponent(msg)}`);
  }
}

export async function updateConsignaAction(
  id: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    const themeId = await resolveThemeId(formData);
    const subthemeId = await resolveSubthemeId(themeId, formData);
    await updateItem(
      id,
      {
        title: readFormString(formData, "title"),
        description: readFormString(formData, "description"),
        themeId,
        subthemeId,
        inspirationType: readOptionalInspirationType(formData),
        inspirationLabel: readFormString(formData, "inspirationLabel") || null,
        inspirationNotes: readFormString(formData, "inspirationNotes") || null,
        tags: parseTagsInput(readFormString(formData, "tags")),
        difficulty: readDifficulty(formData),
        language: readFormString(formData, "language") || "es",
        universal: formData.get("universal") === "on" || formData.get("universal") === "1",
        changeSummary: readFormString(formData, "changeSummary") || null,
        actorUserId: user.id,
      },
      { prisma },
    );
    revalidateLibrary(id);
    redirect(routes.superAdmin.consigna(id));
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error al guardar";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function submitConsignaReviewAction(id: string): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    await submitForReview(id, user.id, { prisma });
    revalidateLibrary(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function approveConsignaAction(id: string): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    await approve(id, user.id, { prisma });
    revalidateLibrary(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function rejectConsignaAction(
  id: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    await reject(id, readFormString(formData, "reason"), user.id, { prisma });
    revalidateLibrary(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function archiveConsignaAction(id: string): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    await archive(id, user.id, { prisma });
    revalidateLibrary(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function restoreConsignaAction(id: string): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    await restore(id, user.id, { prisma });
    revalidateLibrary(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function duplicateConsignaAction(id: string): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    const created = await duplicateItem(id, user.id, { prisma });
    revalidateLibrary(created.id);
    redirect(routes.superAdmin.consigna(created.id));
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error al duplicar";
    redirect(`${routes.superAdmin.consigna(id)}?error=${encodeURIComponent(msg)}`);
  }
}

export async function previewImportAction(formData: FormData): Promise<
  | { ok: true; count: number; titles: string[]; warnings: string[] }
  | { ok: false; error: string }
> {
  try {
    await requireSuperAdmin();
    const preview = await importPreviewFromPayload(readFormString(formData, "json"), {
      prisma,
    });
    if (!preview.okToApply && preview.rows.length === 0) {
      const err =
        preview.issues.find((i) => i.level === "error")?.message ??
        "No hay filas válidas para importar.";
      return { ok: false, error: err };
    }
    return {
      ok: true,
      count: preview.rows.length,
      titles: preview.rows.slice(0, 12).map((r) => r.title),
      warnings: preview.issues
        .filter((i) => i.level === "warning")
        .slice(0, 8)
        .map((i) => i.message),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo previsualizar.",
    };
  }
}

export async function importConsignasAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  try {
    const preview = await importPreviewFromPayload(readFormString(formData, "json"), {
      prisma,
    });
    if (!preview.okToApply) {
      const err =
        preview.issues.find((i) => i.level === "error")?.message ??
        "Importación inválida.";
      redirect(`${routes.superAdmin.import()}?error=${encodeURIComponent(err)}`);
    }
    const result = await importApply(preview.rows, user.id, { prisma });
    revalidateLibrary();
    redirect(`${routes.superAdmin.consignas()}?imported=${result.count}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Error al importar";
    redirect(`${routes.superAdmin.import()}?error=${encodeURIComponent(msg)}`);
  }
}
