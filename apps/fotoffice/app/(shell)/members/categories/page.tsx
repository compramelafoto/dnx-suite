import Link from "next/link";
import { listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { Tag } from "lucide-react";

export default async function MemberCategoriesPage() {
  const { workspace } = await requireMembersManageContext();
  const categories = await listMemberCategories(workspace.id);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Categorías de socios"
        description="Cada workspace define sus propias categorías. No eliminan socios existentes al desactivarse."
        actions={
          <>
            <Link href="/members" className="fo-btn fo-btn-secondary text-sm">
              Volver al padrón
            </Link>
            <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm">
              Nueva categoría
            </Link>
          </>
        }
      />

      {categories.length === 0 ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Tag className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-base font-semibold text-[var(--fo-text)]">Todavía no hay categorías</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Creá al menos una antes de cargar socios — por ejemplo &ldquo;Socio activo&rdquo; o
              &ldquo;Estudiante&rdquo;.
            </p>
          </div>
          <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm">
            Crear primera categoría
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                  <td className="px-4 py-3 font-medium text-[var(--fo-text)]">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)] max-w-xs truncate">
                    {c.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{c.order}</td>
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <span className="text-[var(--fo-success)] font-medium">Activa</span>
                    ) : (
                      <span className="text-[var(--fo-muted)]">Desactivada</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/members/categories/${c.id}/edit`}
                      className="text-[var(--fo-accent)] font-medium hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
