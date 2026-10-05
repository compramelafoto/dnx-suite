import { notFound } from "next/navigation";
import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogPostForm } from "@/components/website/blog/blog-post-form";
import { parseRouteId, requireBlogEditor } from "@/lib/blog/access";
import { mapBlogPostToFormValues } from "@/lib/blog/admin-form";
import { BLOG_STATUS_LABELS, blogDisplayStatus, formatBlogDateTime } from "@/lib/blog/admin-labels";
import { getBlogAdminPost, loadPublicSlug } from "@/lib/blog/admin-queries";
import { postPath } from "@/lib/blog/public";
import { BlogSendToMembersCard } from "@/components/website/blog/blog-send-to-members-card";
import { loadBlogBannerPanel } from "@/lib/blog/banner-slot";
import { BlogBannerPanel } from "@/components/website/blog/blog-banner-panel";

export const dynamic = "force-dynamic";
// El envío a socios corre dentro de la acción de esta página: hasta unos 45 s de tandas.
export const maxDuration = 120;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ correo_ok?: string; correo_error?: string }>;
};

export default async function EditBlogPostPage({ params, searchParams }: Props) {
  const { workspace } = await requireBlogEditor();
  const postId = parseRouteId((await params).id);
  if (!postId) notFound();

  // Con el filtro de la institución: el id de un artículo de otra institución da 404.
  const [post, publicSlug, banner] = await Promise.all([
    getBlogAdminPost(workspace.id, postId),
    loadPublicSlug(workspace.id),
    // Si falla (por ejemplo, la tabla todavía no está en la base), el editor sigue andando sin el panel.
    loadBlogBannerPanel(workspace.id, postId).catch((err: unknown) => {
      console.error("[fotoffice][blog] no se pudo leer el banner del artículo:", err);
      return null;
    }),
  ]);
  if (!post) notFound();

  const clave = blogDisplayStatus(post.status, post.publishedAt);
  const estado =
    clave === "SCHEDULED" && post.publishedAt
      ? `Programado para el ${formatBlogDateTime(post.publishedAt)} (hora argentina)`
      : (BLOG_STATUS_LABELS[clave] ?? clave);
  const sp = await searchParams;

  return (
    <BlogShell
      title={post.title}
      description={`Estado: ${estado}. Los cambios se ven en el blog en cuanto el artículo está publicado.`}
      actions={
        clave === "PUBLISHED" && publicSlug ? (
          <a href={postPath(publicSlug, post.slug)} target="_blank" rel="noreferrer" className="fo-btn fo-btn-secondary">
            Ver publicado
          </a>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <BlogSendToMembersCard
          workspaceId={workspace.id}
          postId={post.id}
          published={clave === "PUBLISHED"}
          okMessage={sp.correo_ok}
          errorMessage={sp.correo_error}
        />
        <BlogPostForm mode="edit" postId={post.id} initialValues={mapBlogPostToFormValues(post)} />
        {banner ? <BlogBannerPanel postId={post.id} published={post.status === "PUBLISHED"} data={banner} /> : null}
      </div>
    </BlogShell>
  );
}
