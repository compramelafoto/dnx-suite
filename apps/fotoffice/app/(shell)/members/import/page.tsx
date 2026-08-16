import Link from "next/link";
import { listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { buildMemberImportPrompt } from "@/lib/members/import/prompt";
import { MEMBER_IMPORT_HEADER_ROW } from "@/lib/members/import/columns";
import { MemberImportWizard } from "@/components/members/member-import-wizard";

export default async function MemberImportPage() {
  const { workspace } = await requireMembersManageContext();
  const categories = await listMemberCategories(workspace.id);
  const categoryNames = categories.map((c) => c.name);

  const prompt = buildMemberImportPrompt({ workspaceName: workspace.name, categoryNames });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Importar socios"
        description="Cargá muchos socios a la vez a partir de un CSV — con o sin ayuda de una IA externa."
        actions={
          <Link href="/members" className="fo-btn fo-btn-secondary text-sm">
            Volver al padrón
          </Link>
        }
      />
      <MemberImportWizard
        prompt={prompt}
        csvHeaderExample={MEMBER_IMPORT_HEADER_ROW}
        hasCategories={categoryNames.length > 0}
        workspaceName={workspace.name}
      />
    </div>
  );
}
