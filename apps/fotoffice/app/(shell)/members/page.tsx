import Link from "next/link";
import { countMembersByStatus, listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { listadoSocios } from "@/lib/members/listado";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { ContextoListado } from "@/lib/listado/tipos";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, canManage } = await requireMembersContext();
  const [v, counts, categories, role] = await Promise.all([
    loadPersonVocabulary(workspace.id),
    countMembersByStatus(workspace.id),
    listMemberCategories(workspace.id),
    resolveWorkspaceRole(user.id, workspace.id),
  ]);
  const ctx: ContextoListado = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  };

  const noMembersAtAll = counts.total === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title={v.Plural}
        description={`Padrón de ${v.plural} de este workspace: alta, edición, categorías y estado.`}
        actions={
          canManage ? (
            <>
              <Link href="/members/categories" className="fo-btn fo-btn-secondary text-sm">
                Categorías
              </Link>
              <Link href="/members/import" className="fo-btn fo-btn-secondary text-sm">
                {`Importar ${v.plural}`}
              </Link>
              <Link href="/members/new" className="fo-btn fo-btn-primary text-sm">
                {`Agregar ${v.singular}`}
              </Link>
            </>
          ) : undefined
        }
      />

      {noMembersAtAll ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            {/* Reformulado para no depender del género: "cargados" concordaba en masculino
                con "socios" y no con la palabra que configure cada workspace. */}
            <p className="text-base font-semibold text-[var(--fo-text)]">{`El padrón de ${v.plural} todavía está vacío`}</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              {categories.length === 0
                ? `Primero creá al menos una categoría de ${v.singular}, después vas a poder cargar ${v.plural}.`
                : `Empezá cargando ${v.plural} al padrón de este workspace.`}
            </p>
          </div>
          {canManage ? (
            categories.length === 0 ? (
              <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm">
                Crear primera categoría
              </Link>
            ) : (
              <Link href="/members/new" className="fo-btn fo-btn-primary text-sm">
                {`Agregar ${v.singular}`}
              </Link>
            )
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Total</p>
              <p className="text-2xl font-semibold text-[var(--fo-text)] mt-1">{counts.total}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Activos</p>
              <p className="text-2xl font-semibold text-[var(--fo-success)] mt-1">{counts.ACTIVE}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Suspendidos</p>
              <p className="text-2xl font-semibold text-[var(--fo-text)] mt-1">{counts.SUSPENDED}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Inactivos</p>
              <p className="text-2xl font-semibold text-[var(--fo-muted)] mt-1">{counts.INACTIVE}</p>
            </div>
          </div>

          <Listado def={listadoSocios(v)} ctx={ctx} ruta="/members" searchParams={searchParams} />
        </>
      )}
    </div>
  );
}
