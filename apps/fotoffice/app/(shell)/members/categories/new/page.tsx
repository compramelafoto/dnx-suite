import Link from "next/link";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { CategoryForm } from "@/components/members/category-form";

export default async function NewMemberCategoryPage() {
  await requireMembersManageContext();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Nueva categoría"
        actions={
          <Link href="/members/categories" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />
      <CategoryForm />
    </div>
  );
}
