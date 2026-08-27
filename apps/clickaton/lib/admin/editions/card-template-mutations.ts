"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadTemplateV2LegacyPayload } from "@repo/db/template-v2-repository";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { validateClickatonCardTemplate } from "@/lib/participant-cards/participant-card-template-source";

const CARD_TYPES = { welcome: "WELCOME", member: "MEMBER" } as const;

function cardTemplatesPath(editionId: string, query?: string): string {
  const base = `${adminRoutes.editions}/${editionId}/placas`;
  return query ? `${base}?${query}` : base;
}

function parseCardType(raw: string): "WELCOME" | "MEMBER" | null {
  const value = raw.trim().toLowerCase();
  if (value === "welcome") return CARD_TYPES.welcome;
  if (value === "member") return CARD_TYPES.member;
  return null;
}

/**
 * Asigna una plantilla del editor visual a una placa de la edición.
 *
 * Valida la plantilla **antes** de guardarla: si usa variables que Clickatón no
 * conoce o bloques no soportados, se rechaza acá con un mensaje claro en vez de
 * dejar que falle en el momento de generar la placa de un participante.
 */
export async function assignCardTemplateFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();

  const editionId = formData.get("editionId")?.toString()?.trim() ?? "";
  if (!editionId) redirect(adminRoutes.editions);

  const cardType = parseCardType(formData.get("cardType")?.toString() ?? "");
  if (!cardType) {
    redirect(cardTemplatesPath(editionId, "error=Tipo+de+placa+inv%C3%A1lido"));
  }

  const templateId = formData.get("templateId")?.toString()?.trim() ?? "";

  // Vacío = volver al diseño oficial del código.
  if (!templateId) {
    const cleared = await withClickatonDb(async () =>
      prisma.clickatonCardTemplateAssignment.deleteMany({
        where: { editionId, cardType },
      })
    );
    if (!cleared.ok) {
      redirect(cardTemplatesPath(editionId, `error=${encodeURIComponent(cleared.message)}`));
    }
    revalidatePath(cardTemplatesPath(editionId));
    redirect(cardTemplatesPath(editionId, "ok=plantilla-quitada"));
  }

  const pinVersion = formData.get("pinVersion")?.toString() === "on";

  const loaded = await withClickatonDb(async () =>
    loadTemplateV2LegacyPayload(prisma, { templateId, versionId: null })
  );
  if (!loaded.ok) {
    redirect(cardTemplatesPath(editionId, `error=${encodeURIComponent(loaded.message)}`));
  }
  if (!loaded.data) {
    redirect(
      cardTemplatesPath(
        editionId,
        "error=" + encodeURIComponent("La plantilla no existe o no tiene versiones")
      )
    );
  }

  const issues = validateClickatonCardTemplate(loaded.data.payload);
  if (issues.length > 0) {
    redirect(
      cardTemplatesPath(
        editionId,
        "error=" +
          encodeURIComponent(
            `La plantilla no se puede usar: ${issues.map((i) => i.message).join(" · ")}`
          )
      )
    );
  }

  const saved = await withClickatonDb(async () =>
    prisma.clickatonCardTemplateAssignment.upsert({
      where: { editionId_cardType: { editionId, cardType } },
      create: {
        editionId,
        cardType,
        templateId,
        versionId: pinVersion ? loaded.data!.versionId : null,
        enabled: true,
        assignedByUserId: user.id,
      },
      update: {
        templateId,
        versionId: pinVersion ? loaded.data!.versionId : null,
        enabled: true,
        assignedByUserId: user.id,
      },
    })
  );
  if (!saved.ok) {
    redirect(cardTemplatesPath(editionId, `error=${encodeURIComponent(saved.message)}`));
  }

  revalidatePath(cardTemplatesPath(editionId));
  redirect(cardTemplatesPath(editionId, "ok=plantilla-asignada"));
}

/** Enciende o apaga la plantilla sin perder la elección. */
export async function toggleCardTemplateFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();

  const editionId = formData.get("editionId")?.toString()?.trim() ?? "";
  const cardType = parseCardType(formData.get("cardType")?.toString() ?? "");
  if (!editionId || !cardType) redirect(adminRoutes.editions);

  const enabled = formData.get("enabled")?.toString() === "true";

  const result = await withClickatonDb(async () =>
    prisma.clickatonCardTemplateAssignment.updateMany({
      where: { editionId, cardType },
      data: { enabled },
    })
  );
  if (!result.ok) {
    redirect(cardTemplatesPath(editionId, `error=${encodeURIComponent(result.message)}`));
  }

  revalidatePath(cardTemplatesPath(editionId));
  redirect(
    cardTemplatesPath(editionId, enabled ? "ok=plantilla-activada" : "ok=plantilla-pausada")
  );
}
