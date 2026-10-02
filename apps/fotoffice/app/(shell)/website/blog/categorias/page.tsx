import { BlogShell } from "@/components/website/blog/blog-shell";
import { BlogTaxonomyManager } from "@/components/website/blog/blog-taxonomy-manager";
import { requireBlogEditor } from "@/lib/blog/access";

export const dynamic = "force-dynamic";

export default async function BlogCategoriesPage() {
  await requireBlogEditor();
  return (
    <BlogShell title="Categorías del blog" description="Ordenan el blog en secciones. Cada categoría tiene su propia página con sus artículos.">
      <BlogTaxonomyManager kind="categories" />
    </BlogShell>
  );
}
