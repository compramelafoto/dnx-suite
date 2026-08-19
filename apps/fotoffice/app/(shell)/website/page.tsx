import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { WebsiteEditor } from "@/components/website/editor/website-editor";

export default async function WebsiteEditorPage() {
  const { canEdit, status, sections, draftUpdatedAtIso } = await loadWebsiteCmsContext();

  return (
    <WebsiteShell status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <WebsiteEditor initialBlocks={sections.pages.home ?? []} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso} />
    </WebsiteShell>
  );
}
