import { prisma } from "@repo/db";
import { requireWebsiteContext } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { PageHeader } from "@/components/page-header";
import { WebsitePublishForm } from "@/components/website-publish-form";

export default async function WebsitePage() {
  const { workspace, user } = await requireWebsiteContext();

  const [website, membership] = await Promise.all([
    prisma.fotofficeWorkspaceWebsite.findUnique({ where: { workspaceId: workspace.id } }),
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      select: { role: true },
    }),
  ]);
  const canEdit = canManageWorkspaceSettings(membership?.role);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Sitio web"
        description="Base del sitio público del workspace. Todavía en construcción: por ahora solo podés controlar si está publicado o no."
      />
      <WebsitePublishForm published={website?.publishedAt != null} canEdit={canEdit} />
    </div>
  );
}
