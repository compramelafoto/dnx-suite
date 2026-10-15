import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogTaxonomyManager } from "@/components/website/blog/blog-taxonomy-manager";
import { requireBlogEditor } from "@/lib/blog/access";

export const dynamic = "force-dynamic";

export default async function BlogTagsPage() {
  await requireBlogEditor();
  return (
    <BlogShell title="Tags del blog" description="Etiquetas libres que agrupan artículos de distintas categorías. Cada tag tiene su propia página.">
      <BlogTaxonomyManager kind="tags" />
    </BlogShell>
  );
}
