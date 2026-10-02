import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogMediaLibrary } from "@/components/website/blog/blog-media-library";
import { requireBlogEditor } from "@/lib/blog/access";

export const dynamic = "force-dynamic";

export default async function BlogMediaPage() {
  await requireBlogEditor();
  return (
    <BlogShell
      title="Imágenes del blog"
      description="Las imágenes que subiste para los artículos, listas para reutilizar. JPG, PNG o WebP de hasta 8 MB."
    >
      <BlogMediaLibrary />
    </BlogShell>
  );
}
