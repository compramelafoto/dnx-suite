"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireWebsiteContext } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { websitePageContentSchema, type WebsitePageContent } from "@/lib/website/blocks";

export type WebsitePublishState = { error: string | null; ok?: boolean };
export type WebsiteDraftSaveState = { error: string | null; ok?: boolean };

async function assertCanManageWebsite(
  workspaceId: string,
  userId: number,
  verb: "publicar" | "despublicar" | "editar",
): Promise<string | null> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  return canManageWorkspaceSettings(membership?.role) ? null : `No tenés permiso para ${verb} el sitio web.`;
}

/**
 * Publica el borrador actual: crea un snapshot INMUTABLE nuevo en
 * FotofficeWorkspaceWebsiteVersion y apunta publishedVersionId hacia él. Nunca modifica una
 * versión ya creada. Todo en una única transacción — si algo falla, no queda ninguna versión
 * a medio publicar.
 *
 * Concurrencia optimista: si el formulario trae `draftUpdatedAt` (el `updatedAt` del borrador
 * tal como lo vio el usuario al abrir la pantalla) y ya no coincide con el real, se aborta sin
 * publicar — alguien más lo modificó mientras tanto.
 */
export async function publishWebsiteAction(
  _prev: WebsitePublishState | undefined,
  formData: FormData,
): Promise<WebsitePublishState> {
  const { workspace, user } = await requireWebsiteContext();
  const permError = await assertCanManageWebsite(workspace.id, user.id, "publicar");
  if (permError) return { error: permError };

  const expectedUpdatedAtRaw = formData.get("draftUpdatedAt")?.toString();

  try {
    await prisma.$transaction(async (tx) => {
      const draft = await tx.fotofficeWorkspaceWebsite.upsert({
        where: { workspaceId: workspace.id },
        update: {},
        create: { workspaceId: workspace.id },
      });

      if (expectedUpdatedAtRaw && draft.updatedAt.toISOString() !== expectedUpdatedAtRaw) {
        throw new Error("STALE_DRAFT");
      }

      const last = await tx.fotofficeWorkspaceWebsiteVersion.aggregate({
        where: { websiteId: draft.id },
        _max: { versionNumber: true },
      });
      const nextVersionNumber = (last._max.versionNumber ?? 0) + 1;
      const now = new Date();

      const version = await tx.fotofficeWorkspaceWebsiteVersion.create({
        data: {
          websiteId: draft.id,
          versionNumber: nextVersionNumber,
          heroTitle: draft.heroTitle,
          heroSubtitle: draft.heroSubtitle,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          navJson: draft.navJson ?? undefined,
          sectionsJson: draft.sectionsJson ?? undefined,
          publishedByUserId: user.id,
          publishedAt: now,
        },
      });

      await tx.fotofficeWorkspaceWebsite.update({
        where: { id: draft.id },
        data: { publishedVersionId: version.id, publishedAt: now },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "STALE_DRAFT") {
      return { error: "Alguien más modificó el sitio mientras tanto. Recargá la página e intentá de nuevo." };
    }
    return { error: "No se pudo publicar el sitio web." };
  }

  revalidatePath("/website");
  return { error: null, ok: true };
}

/**
 * Despublica: el sitio deja de tener una versión pública activa. NO borra la versión publicada
 * ni ninguna otra del historial, y NO toca el borrador — ambos quedan intactos para publicar de
 * nuevo (misma versión u otra) más adelante.
 */
export async function unpublishWebsiteAction(
  _prev: WebsitePublishState | undefined,
  _formData: FormData,
): Promise<WebsitePublishState> {
  const { workspace, user } = await requireWebsiteContext();
  const permError = await assertCanManageWebsite(workspace.id, user.id, "despublicar");
  if (permError) return { error: permError };

  try {
    await prisma.fotofficeWorkspaceWebsite.update({
      where: { workspaceId: workspace.id },
      data: { publishedVersionId: null, publishedAt: null },
    });
  } catch {
    return { error: "No se pudo despublicar el sitio web." };
  }

  revalidatePath("/website");
  return { error: null, ok: true };
}

/**
 * Guarda campos del BORRADOR (nunca crea una Version). Concurrencia optimista atómica: el
 * `update` solo pisa la fila si `updatedAt` sigue siendo el que el cliente vio al cargar la
 * pantalla — si otra sesión ya guardó mientras tanto, `updateMany` afecta 0 filas y se informa
 * el conflicto en vez de pisar en silencio.
 */
async function saveDraftFields(
  workspaceId: string,
  expectedUpdatedAtRaw: string | undefined,
  data: Parameters<typeof prisma.fotofficeWorkspaceWebsite.updateMany>[0]["data"],
): Promise<WebsiteDraftSaveState> {
  if (!expectedUpdatedAtRaw) return { error: "Falta la referencia de concurrencia del borrador." };
  const expectedUpdatedAt = new Date(expectedUpdatedAtRaw);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return { error: "Referencia de concurrencia inválida." };
  }

  const result = await prisma.fotofficeWorkspaceWebsite.updateMany({
    where: { workspaceId, updatedAt: expectedUpdatedAt },
    data,
  });
  if (result.count === 0) {
    return { error: "Alguien más modificó el sitio mientras tanto. Recargá la página e intentá de nuevo." };
  }
  return { error: null, ok: true };
}

/** Guarda la lista de bloques de la Home (pestaña Editor) en `sectionsJson.pages.home`. */
export async function saveWebsiteBlocksAction(
  _prev: WebsiteDraftSaveState | undefined,
  formData: FormData,
): Promise<WebsiteDraftSaveState> {
  const { workspace, user } = await requireWebsiteContext();
  const permError = await assertCanManageWebsite(workspace.id, user.id, "editar");
  if (permError) return { error: permError };

  const raw = formData.get("blocksJson")?.toString() ?? "[]";
  let blocks: WebsitePageContent;
  try {
    blocks = websitePageContentSchema.parse(JSON.parse(raw));
  } catch {
    return { error: "Los bloques enviados no tienen un formato válido." };
  }

  const result = await saveDraftFields(workspace.id, formData.get("draftUpdatedAt")?.toString(), {
    sectionsJson: { pages: { home: blocks } },
  });
  if (result.error) return result;

  revalidatePath("/website");
  revalidatePath("/website/preview");
  return { error: null, ok: true };
}

/** Guarda título y descripción SEO (pestaña SEO) en el borrador. */
export async function saveWebsiteSeoAction(
  _prev: WebsiteDraftSaveState | undefined,
  formData: FormData,
): Promise<WebsiteDraftSaveState> {
  const { workspace, user } = await requireWebsiteContext();
  const permError = await assertCanManageWebsite(workspace.id, user.id, "editar");
  if (permError) return { error: permError };

  const seoTitle = formData.get("seoTitle")?.toString()?.trim() || null;
  const seoDescription = formData.get("seoDescription")?.toString()?.trim() || null;
  if (seoTitle && seoTitle.length > 200) return { error: "El título SEO es demasiado largo." };
  if (seoDescription && seoDescription.length > 400) return { error: "La descripción SEO es demasiado larga." };

  const result = await saveDraftFields(workspace.id, formData.get("draftUpdatedAt")?.toString(), {
    seoTitle,
    seoDescription,
  });
  if (result.error) return result;

  revalidatePath("/website");
  return { error: null, ok: true };
}

export type WebsiteBrandingColorsState = { error: string | null; ok?: boolean };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Guarda los 5 colores del sitio — misma fuente de verdad que Configuración
 * (`FotofficeWorkspaceBranding`), Website solo la edita, no la duplica. */
export async function saveWebsiteBrandingColorsAction(
  _prev: WebsiteBrandingColorsState | undefined,
  formData: FormData,
): Promise<WebsiteBrandingColorsState> {
  const { workspace, user } = await requireWebsiteContext();
  const permError = await assertCanManageWebsite(workspace.id, user.id, "editar");
  if (permError) return { error: permError };

  const fields = ["primaryColor", "secondaryColor", "backgroundColor", "textColor", "accentColor"] as const;
  const data: Record<(typeof fields)[number], string | null> = {
    primaryColor: null,
    secondaryColor: null,
    backgroundColor: null,
    textColor: null,
    accentColor: null,
  };
  for (const field of fields) {
    const value = formData.get(field)?.toString()?.trim() || "";
    if (value && !HEX_COLOR_RE.test(value)) {
      return { error: "Los colores deben tener formato hexadecimal (ej. #0EA5E9)." };
    }
    data[field] = value || null;
  }

  try {
    await prisma.fotofficeWorkspaceBranding.update({ where: { workspaceId: workspace.id }, data });
  } catch {
    return { error: "No se pudo guardar el diseño." };
  }

  revalidatePath("/website/diseno");
  revalidatePath("/website/preview");
  return { error: null, ok: true };
}
