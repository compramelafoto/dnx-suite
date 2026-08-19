import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { WebsiteSeoForm } from "@/components/website/seo/website-seo-form";

export default async function WebsiteSeoPage() {
  const { draft, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();

  return (
    <WebsiteShell status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <WebsiteSeoForm
        initialSeoTitle={draft.seoTitle}
        initialSeoDescription={draft.seoDescription}
        canEdit={canEdit}
        draftUpdatedAt={draftUpdatedAtIso}
      />
    </WebsiteShell>
  );
}
