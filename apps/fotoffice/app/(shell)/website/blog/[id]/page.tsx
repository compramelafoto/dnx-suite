import { notFound } from "next/navigation";
import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogPostForm } from "@/components/website/blog/blog-post-form";
import { parseRouteId, requireBlogEditor } from "@/lib/blog/access";
import { mapBlogPostToFormValues } from "@/lib/blog/admin-form";
import { BLOG_STATUS_LABELS } from "@/lib/blog/admin-labels";
import { getBlogAdminPost, loadPublicSlug } from "@/lib/blog/admin-queries";
import { postPath } from "@/lib/blog/public";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditBlogPostPage({ params }: Props) {
  const { workspace } = await requireBlogEditor();
  const postId = parseRouteId((await params).id);
  if (!postId) notFound();

  // Con el filtro de la institución: el id de un artículo de otra institución da 404.
  const [post, publicSlug] = await Promise.all([getBlogAdminPost(workspace.id, postId), loadPublicSlug(workspace.id)]);
  if (!post) notFound();

  const estado = BLOG_STATUS_LABELS[post.status] ?? post.status;

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
      <BlogPostForm mode="edit" postId={post.id} initialValues={mapBlogPostToFormValues(post)} />
    </BlogShell>
  );
}
