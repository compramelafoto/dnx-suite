import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberCategory } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { CategoryForm } from "@/components/members/category-form";

export default async function EditMemberCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireMembersManageContext();
  const { id } = await params;
  const category = await getMemberCategory(workspace.id, id);
  if (!category) notFound();

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Editar categoría: ${category.name}`}
        actions={
          <Link href="/members/categories" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />
      <CategoryForm category={category} />
    </div>
  );
}
