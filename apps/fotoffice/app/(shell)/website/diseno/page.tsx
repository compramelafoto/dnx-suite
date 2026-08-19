import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { WebsiteDesignForm } from "@/components/website/design/website-design-form";

export default async function WebsiteDesignPage() {
  const { workspace, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { primaryColor: true, secondaryColor: true, backgroundColor: true, textColor: true, accentColor: true },
  });

  return (
    <WebsiteShell status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <WebsiteDesignForm
        initialColors={{
          primaryColor: branding?.primaryColor ?? null,
          secondaryColor: branding?.secondaryColor ?? null,
          backgroundColor: branding?.backgroundColor ?? null,
          textColor: branding?.textColor ?? null,
          accentColor: branding?.accentColor ?? null,
        }}
        canEdit={canEdit}
      />
    </WebsiteShell>
  );
}
