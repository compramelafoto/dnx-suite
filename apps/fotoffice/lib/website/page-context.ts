import { prisma } from "@repo/db";
import { requireWebsiteContext } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { ensureWebsiteDraft } from "./draft";
import { computeWebsiteChangeStatus, type WebsiteChangeStatus } from "./change-status";
import { parseWebsiteSections, type WebsiteSections } from "./blocks";
import { parseWebsiteDesignPresets, type WebsiteDesignPresets } from "./design-presets";

/** Contexto común a las 6 pantallas del CMS (Editor/Diseño/Navegación/SEO/Historial/Preview):
 * workspace activo + permisos + borrador (garantizado existente) + estado de publicación. Se
 * calcula una sola vez por request de cada Server Component, no hay estado compartido entre
 * pestañas — cada navegación vuelve a resolver esto desde cero (Next.js App Router estándar). */
export async function loadWebsiteCmsContext() {
  const { workspace, user } = await requireWebsiteContext();

  const [draft, membership, hasAnyVersionHistory] = await Promise.all([
    ensureWebsiteDraft(workspace.id),
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      select: { role: true },
    }),
    prisma.fotofficeWorkspaceWebsiteVersion
      .count({ where: { website: { workspaceId: workspace.id } }, take: 1 })
      .then((n) => n > 0),
  ]);

  const publishedVersion = draft.publishedVersionId
    ? await prisma.fotofficeWorkspaceWebsiteVersion.findUnique({ where: { id: draft.publishedVersionId } })
    : null;

  const status: WebsiteChangeStatus = computeWebsiteChangeStatus({
    draft: {
      heroTitle: draft.heroTitle,
      heroSubtitle: draft.heroSubtitle,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
      navJson: draft.navJson,
      sectionsJson: draft.sectionsJson,
      designPresetsJson: draft.designPresetsJson,
    },
    publishedVersion: publishedVersion
      ? {
          heroTitle: publishedVersion.heroTitle,
          heroSubtitle: publishedVersion.heroSubtitle,
          seoTitle: publishedVersion.seoTitle,
          seoDescription: publishedVersion.seoDescription,
          navJson: publishedVersion.navJson,
          sectionsJson: publishedVersion.sectionsJson,
          designPresetsJson: publishedVersion.designPresetsJson,
        }
      : null,
    hasAnyVersionHistory,
  });

  const canEdit = canManageWorkspaceSettings(membership?.role);
  const sections: WebsiteSections = parseWebsiteSections(draft.sectionsJson);
  const designPresets: WebsiteDesignPresets = parseWebsiteDesignPresets(draft.designPresetsJson);

  return {
    workspace,
    user,
    draft,
    canEdit,
    status,
    sections,
    designPresets,
    draftUpdatedAtIso: draft.updatedAt.toISOString(),
  };
}
