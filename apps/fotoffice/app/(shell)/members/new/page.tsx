import Link from "next/link";
import { listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { MemberForm } from "@/components/members/member-form";

export default async function NewMemberPage() {
  const { workspace } = await requireMembersManageContext();
  const categories = await listMemberCategories(workspace.id, { onlyActive: true });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Nuevo socio"
        description="Cargá los datos básicos. Podés completar el resto más adelante desde la ficha."
        actions={
          <Link href="/members" className="fo-btn fo-btn-secondary text-sm">
            Volver al padrón
          </Link>
        }
      />
      {categories.length === 0 ? (
        <div className="fo-card space-y-3">
          <p className="text-sm text-[var(--fo-text)] font-medium">
            Todavía no hay ninguna categoría activa en este workspace.
          </p>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Creá al menos una categoría antes de cargar el primer socio.
          </p>
          <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm inline-flex w-fit">
            Crear categoría
          </Link>
        </div>
      ) : (
        <MemberForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      )}
    </div>
  );
}
