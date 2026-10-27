import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { parseWebsiteSiteSettings } from "@/lib/website/site-settings";
import { WebsiteShell } from "@/components/website/website-shell";
import { WebsiteSettingsForm } from "@/components/website/ajustes/website-settings-form";

/**
 * Sitio web → Ajustes: lo que en Prosite estaba repartido entre SEO, Configuración y Redes
 * sociales. Edita el BORRADOR; se ve en el sitio al publicar.
 */
export default async function WebsiteAjustesPage() {
  const { workspace, draft, canEdit, status, draftUpdatedAtIso, sections } = await loadWebsiteCmsContext();
  const settings = parseWebsiteSiteSettings(draft.designPresetsJson);
  const pages = Object.entries(sections.pageMeta).map(([key, meta]) => ({
    key,
    title: meta.title,
    slug: meta.slug,
    shareImageUrl: meta.shareImageUrl ?? null,
    hideFromSearch: meta.hideFromSearch === true,
  }));

  return (
    <WebsiteShell workspaceId={workspace.id} status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <WebsiteSettingsForm initial={settings} pages={pages} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso} />
    </WebsiteShell>
  );
}
