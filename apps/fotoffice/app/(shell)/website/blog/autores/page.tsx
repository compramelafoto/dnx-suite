import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogTaxonomyManager } from "@/components/website/blog/blog-taxonomy-manager";
import { requireBlogEditor } from "@/lib/blog/access";

export const dynamic = "force-dynamic";

export default async function BlogAuthorsPage() {
  await requireBlogEditor();
  return (
    <BlogShell title="Autores del blog" description="Quiénes firman los artículos. Son opcionales: un artículo se puede publicar sin autor.">
      <BlogTaxonomyManager kind="authors" />
    </BlogShell>
  );
}
