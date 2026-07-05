import { notFound } from "next/navigation";
import AdminBlogEditClient from "@/components/blog/admin/AdminBlogEditClient";
import { mapAdminBlogPostToFormValues } from "@/lib/blog/admin-blog-form";
import { getAdminBlogPostForEdit } from "@/lib/blog/admin-blog-post";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminBlogEditPage({ params }: PageProps) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId) || postId <= 0) notFound();

  const post = await getAdminBlogPostForEdit(postId);
  if (!post) notFound();

  return (
    <AdminBlogEditClient
      postId={postId}
      initialValues={mapAdminBlogPostToFormValues(post)}
      initialStatus={post.status}
      initialSlug={post.slug}
    />
  );
}
