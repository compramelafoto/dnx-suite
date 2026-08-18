import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { CreateWorkspaceForm } from "@/components/super-admin-forms";
import { listModules } from "@/lib/modules/registry";

export default async function SuperAdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const moduleFilter = sp.module?.trim() || undefined;
  const availableModules = listModules({ status: "AVAILABLE" });

  const workspaces = await prisma.workspace.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { fotofficeBranding: { publicSlug: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      memberships: { select: { id: true } },
      fotofficeBranding: { select: { publicSlug: true } },
      featureModules: { where: { enabled: true }, select: { moduleKey: true } },
    },
  });

  const visible = moduleFilter
    ? workspaces.filter((w) => w.featureModules.some((fm) => fm.moduleKey === moduleFilter))
    : workspaces;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Workspaces"
        description="Alta y supervisión de workspaces de toda la plataforma. Administrá los módulos de cada uno desde su ficha."
      />
      <CreateWorkspaceForm />

      <form method="get" className="flex flex-wrap gap-3 items-end">
        <div className="fo-field-stack flex-1 min-w-[200px]">
          <label className="fo-label" htmlFor="q">
            Buscar por nombre o slug
          </label>
          <input id="q" name="q" defaultValue={q ?? ""} className="fo-input" placeholder="sfpr, DNX Estudio…" />
        </div>
        <div className="fo-field-stack min-w-[180px]">
          <label className="fo-label" htmlFor="module">
            Filtrar por módulo
          </label>
          <select id="module" name="module" defaultValue={moduleFilter ?? ""} className="fo-input">
            <option value="">Todos</option>
            {availableModules.map((m) => (
              <option key={m.key} value={m.key}>
                Con {m.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="fo-btn fo-btn-secondary text-sm min-h-10">
          Buscar
        </button>
        {q || moduleFilter ? (
          <Link href="/admin/workspaces" className="fo-btn fo-btn-ghost text-sm min-h-10">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Ningún workspace coincide con la búsqueda.</p>
        ) : (
          visible.map((w) => (
            <div
              key={w.id}
              className="fo-card flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--fo-text)] truncate">{w.name}</p>
                <p className="text-xs text-[var(--fo-muted)] font-mono">
                  {w.fotofficeBranding?.publicSlug ?? "sin slug"}
                </p>
                <p className="text-xs text-[var(--fo-muted)] mt-1">
                  {w.memberships.length} miembro(s) · {w.featureModules.length} de{" "}
                  {availableModules.length} módulos activos
                </p>
              </div>
              <Link href={`/admin/workspaces/${w.id}`} className="fo-btn fo-btn-secondary text-sm shrink-0">
                Administrar módulos
              </Link>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-[var(--fo-muted)]">
        Mostrando {visible.length} de {workspaces.length} workspace(s)
        {q || moduleFilter ? " (filtrado)" : ""}.
      </p>
    </div>
  );
}
