"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assignToEdition,
  createItem,
  listItems,
  listThemes,
  MAX_PROMPTS_PER_EDITION,
  reorderEditionPrompts,
  unassignFromEdition,
  type PhotoPromptDifficulty,
  type PhotoPromptInspirationType,
} from "@repo/photo-prompt-library";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  CAPABILITY_MANAGE_TIMELINE,
  hasEditionCapability,
} from "@/lib/timeline/permissions";
import { isOpsTestEdition } from "./ops-test-edition";

async function requireManage(editionId: string) {
  const user = await requireClickatonAdmin();
  const ok = await hasEditionCapability({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
    editionId,
    capability: CAPABILITY_MANAGE_TIMELINE,
  });
  if (!ok) throw new Error("FORBIDDEN");
  return user;
}

function revalidateConsignas(editionId: string) {
  revalidatePath(`${adminRoutes.editions}/${editionId}/consignas`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/cronograma`);
}

export async function listApprovedLibraryForPickerAction(input?: {
  text?: string;
  themeId?: string;
  difficulty?: PhotoPromptDifficulty;
  inspirationType?: PhotoPromptInspirationType;
}) {
  await requireClickatonAdmin();
  const [items, themes] = await Promise.all([
    listItems(
      {
        status: "APPROVED",
        text: input?.text?.trim() || undefined,
        themeId: input?.themeId || undefined,
        difficulty: input?.difficulty || undefined,
        inspirationType: input?.inspirationType || undefined,
        take: 200,
      },
      { prisma },
    ),
    listThemes({ prisma }),
  ]);
  return {
    themes: themes.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      themeId: item.themeId,
      themeName: item.theme.name,
      subthemeName: item.subtheme?.name ?? null,
      difficulty: item.difficulty,
      inspirationType: item.inspirationType,
      inspirationLabel: item.inspirationLabel,
      inspirationNotes: item.inspirationNotes,
      usageCount: item.usageCount,
      lastUsedAt: item.lastUsedAt,
      version: item.version,
    })),
  };
}

/**
 * Asigna ítems de biblioteca a la edición.
 * Comercial: solo APPROVED. Fixture ops-test: permite DRAFT con allowDraftForOpsTest.
 */
export async function assignLibraryItemsAction(
  editionId: string,
  libraryItemIds: string[],
) {
  const user = await requireManage(editionId);
  const uniqueIds = [...new Set(libraryItemIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) throw new Error("Sin consignas seleccionadas");

  const allowDraftForOpsTest = await isOpsTestEdition(editionId);
  const existing = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    select: { libraryItemId: true },
  });
  const already = new Set(
    existing.map((p) => p.libraryItemId).filter((id): id is string => Boolean(id)),
  );
  const remaining = MAX_PROMPTS_PER_EDITION - existing.length;
  if (remaining <= 0) {
    throw new Error(`Ya hay ${MAX_PROMPTS_PER_EDITION} consignas en la edición.`);
  }

  const toAssign = uniqueIds.filter((id) => !already.has(id)).slice(0, remaining);
  for (const libraryItemId of toAssign) {
    await assignToEdition(
      {
        editionId,
        libraryItemId,
        actorUserId: user.id,
        allowDraftForOpsTest,
      },
      { prisma },
    );
  }

  revalidateConsignas(editionId);
  return { assigned: toAssign.length, skipped: uniqueIds.length - toAssign.length };
}

export async function assignLibraryItemsFormAction(
  editionId: string,
  formData: FormData,
) {
  const raw = formData.getAll("libraryItemId");
  const ids = raw.map((v) => String(v)).filter(Boolean);
  await assignLibraryItemsAction(editionId, ids);
}

export async function unassignLibraryPromptAction(
  editionId: string,
  promptId: string,
) {
  const user = await requireManage(editionId);
  const prompt = await prisma.clickatonPrompt.findFirst({
    where: { id: promptId, editionId },
    select: { id: true },
  });
  if (!prompt) throw new Error("PROMPT_NOT_FOUND");
  await unassignFromEdition(
    { clickatonPromptId: promptId, actorUserId: user.id },
    { prisma },
  );
  revalidateConsignas(editionId);
}

export async function unassignLibraryPromptFormAction(
  editionId: string,
  promptId: string,
  _formData: FormData,
) {
  await unassignLibraryPromptAction(editionId, promptId);
}

export async function reorderPromptsAction(
  editionId: string,
  orderedIds: string[],
) {
  const user = await requireManage(editionId);
  await reorderEditionPrompts(editionId, orderedIds, user.id, { prisma });
  revalidateConsignas(editionId);
}

/** Subir / bajar una consigna (accesible; sin drag). */
export async function movePromptFormAction(
  editionId: string,
  promptId: string,
  direction: "up" | "down",
  _formData?: FormData,
) {
  await requireManage(editionId);
  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  const ids = prompts.map((p) => p.id);
  const idx = ids.indexOf(promptId);
  if (idx < 0) throw new Error("PROMPT_NOT_FOUND");
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= ids.length) return;
  const next = [...ids];
  const a = next[idx]!;
  next[idx] = next[swapWith]!;
  next[swapWith] = a;
  await reorderPromptsAction(editionId, next);
}

/**
 * Crea DRAFT en biblioteca. NO asigna automáticamente a la edición.
 */
export async function createLibraryDraftFromEditionAction(
  editionId: string,
  formData: FormData,
) {
  const user = await requireManage(editionId);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  let themeId = String(formData.get("themeId") ?? "").trim();
  if (!title || !description) {
    throw new Error("Título y descripción son obligatorios");
  }
  if (!themeId) {
    const themes = await listThemes({ prisma });
    themeId = themes[0]?.id ?? "";
  }
  if (!themeId) throw new Error("No hay temáticas en la biblioteca");

  const difficultyRaw = String(formData.get("difficulty") ?? "MEDIUM").trim();
  const inspirationTypeRaw = String(formData.get("inspirationType") ?? "").trim();

  const created = await createItem(
    {
      title,
      description,
      themeId,
      difficulty: (difficultyRaw as PhotoPromptDifficulty) || "MEDIUM",
      inspirationType: inspirationTypeRaw
        ? (inspirationTypeRaw as PhotoPromptInspirationType)
        : null,
      inspirationLabel: String(formData.get("inspirationLabel") ?? "").trim() || null,
      inspirationNotes: String(formData.get("inspirationNotes") ?? "").trim() || null,
      createdByUserId: user.id,
      metadataJson: { createdFromEditionId: editionId, autoAssigned: false },
    },
    { prisma },
  );

  revalidateConsignas(editionId);
  redirect(
    `${adminRoutes.editions}/${editionId}/consignas?draftCreated=${encodeURIComponent(created.id)}`,
  );
}

export { isOpsTestEdition };
