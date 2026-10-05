import { notFound } from "next/navigation";
import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogPostForm } from "@/components/website/blog/blog-post-form";
import { parseRouteId, requireBlogEditor } from "@/lib/blog/access";
import { mapBlogPostToFormValues } from "@/lib/blog/admin-form";
import { BLOG_STATUS_LABELS } from "@/lib/blog/admin-labels";
import { getBlogAdminPost, loadPublicSlug } from "@/lib/blog/admin-queries";
import { postPath } from "@/lib/blog/public";
import { BlogSendToMembersCard } from "@/components/website/blog/blog-send-to-members-card";

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
  const [post, publicSlug] = await Promise.all([getBlogAdminPost(workspace.id, postId), loadPublicSlug(workspace.id)]);
  if (!post) notFound();

  const estado = BLOG_STATUS_LABELS[post.status] ?? post.status;
  const sp = await searchParams;
  const publicado = post.status === "PUBLISHED" && (!post.publishedAt || post.publishedAt <= new Date());

  return (
    <BlogShell
      title={post.title}
      description={`Estado: ${estado}. Los cambios se ven en el blog en cuanto el artículo está publicado.`}
      actions={
        post.status === "PUBLISHED" && publicSlug ? (
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
          published={publicado}
          okMessage={sp.correo_ok}
          errorMessage={sp.correo_error}
        />
        <BlogPostForm mode="edit" postId={post.id} initialValues={mapBlogPostToFormValues(post)} />
      </div>
    </BlogShell>
  );
}
