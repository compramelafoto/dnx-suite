import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogPostForm } from "@/components/website/blog/blog-post-form";
import { requireBlogEditor } from "@/lib/blog/access";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  await requireBlogEditor();
  return (
    <BlogShell
      title="Nuevo artículo"
      description="Escribilo y guardalo como borrador; cuando esté listo, publicalo. Categoría, tags y autor son opcionales."
    >
      <BlogPostForm mode="create" />
    </BlogShell>
  );
}
