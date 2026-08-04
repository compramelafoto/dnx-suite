import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import ClickatonContentPostForm from "@/components/admin/content/ClickatonContentPostForm";
import { ContentCmsSurface } from "@/components/admin/content/ContentCmsSurface";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getClickatonAdminPost } from "@/lib/content/admin-queries";
import { mapClickatonPostToFormValues } from "@/lib/content/admin-form";
import { CLICKATON_CONTENT_STATUS_LABELS } from "@/lib/content/content-labels";
import { blogPostPath } from "@/lib/content/content-site-config";
import { parseRouteId } from "@/lib/content/admin-route-utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditContentPage({ params }: Props) {
  await requireClickatonAdmin();

  const postId = parseRouteId((await params).id);
  if (!postId) notFound();

  const post = await getClickatonAdminPost(postId);
  if (!post) notFound();

  const statusLabel = CLICKATON_CONTENT_STATUS_LABELS[post.status] ?? post.status;

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title={post.title}
        description={`Estado: ${statusLabel}. Los cambios se aplican al blog público en cuanto la nota queda publicada.`}
        breadcrumbs={[
          { label: "Contenidos", href: adminRoutes.contents },
          { label: post.title },
        ]}
        actions={
          post.status === "PUBLISHED" ? (
            <Button href={blogPostPath(post.slug)} variant="secondary">
              Ver nota pública
            </Button>
          ) : undefined
        }
      />

      <ContentCmsSurface>
        <ClickatonContentPostForm
          mode="edit"
          postId={post.id}
          initialValues={mapClickatonPostToFormValues(post)}
        />
      </ContentCmsSurface>
    </div>
  );
}
