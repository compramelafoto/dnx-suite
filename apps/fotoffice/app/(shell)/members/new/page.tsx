import Link from "next/link";
import { listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { MemberForm } from "@/components/members/member-form";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";

export default async function NewMemberPage() {
  const { workspace } = await requireMembersManageContext();
  const [categories, v] = await Promise.all([
    listMemberCategories(workspace.id, { onlyActive: true }),
    loadPersonVocabulary(workspace.id),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Agregar ${v.singular}`}
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
          {/* Reformulado: "el primer socio" concordaba "primer" en masculino con la palabra
              configurada; "agregar {plural}" evita el ordinal por completo. */}
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            {`Creá al menos una categoría antes de agregar ${v.plural} al padrón.`}
          </p>
          <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm inline-flex w-fit">
            Crear categoría
          </Link>
        </div>
      ) : (
        <MemberForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} vocabulary={v} />
      )}
    </div>
  );
}
