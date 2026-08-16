import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember, listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { MemberForm } from "@/components/members/member-form";
import { resolveCategoryOptionsForEdit } from "@/lib/members/category-options";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireMembersManageContext();
  const { id } = await params;
  const [member, categories] = await Promise.all([
    getMember(workspace.id, id),
    listMemberCategories(workspace.id, { onlyActive: true }),
  ]);
  if (!member) notFound();

  const categoryOptions = resolveCategoryOptionsForEdit(categories, member.categoryId, member.category);

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Editar: ${member.lastName}, ${member.firstName}`}
        actions={
          <Link href={`/members/${member.id}`} className="fo-btn fo-btn-secondary text-sm">
            Volver a la ficha
          </Link>
        }
      />
      <MemberForm
        member={member}
        categories={categoryOptions.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
