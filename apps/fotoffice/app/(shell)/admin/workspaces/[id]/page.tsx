import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { WorkspaceModuleToggle } from "@/components/workspace-module-toggle";
import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { isMissingCoursesSalesSchemaError } from "@/lib/courses-sales/prisma-errors";
import { listModules } from "@/lib/modules/registry";

export default async function SuperAdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true, name: true, fotofficeBranding: { select: { publicSlug: true } } },
  });
  if (!workspace) notFound();

  const availableModules = listModules({ status: "AVAILABLE" });

  let enabledByModule = new Map<string, boolean>();
  let schemaMissing = false;
  try {
    const rows = await prisma.workspaceFeatureModule.findMany({
      where: { workspaceId: id, moduleKey: { in: availableModules.map((m) => m.key) } },
      select: { moduleKey: true, enabled: true },
    });
    enabledByModule = new Map(rows.map((r) => [r.moduleKey, r.enabled]));
  } catch (e) {
    if (!isMissingCoursesSalesSchemaError(e)) throw e;
    schemaMissing = true;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={workspace.name}
          description={`Slug público: ${workspace.fotofficeBranding?.publicSlug ?? "sin slug"}`}
        />
        <details className="fo-card p-0">
          <summary className="cursor-pointer select-none px-4 py-2 text-sm text-[var(--fo-muted)] list-none">
            ⋯ Más acciones
          </summary>
          <div className="px-4 pb-4 pt-1 border-t border-[var(--fo-border)]">
            <DeleteWorkspaceDialog
              workspaceId={workspace.id}
              workspaceName={workspace.name}
              publicSlug={workspace.fotofficeBranding?.publicSlug ?? null}
            />
          </div>
        </details>
      </div>

      <Link href="/admin/workspaces" className="text-sm text-[var(--fo-accent)] hover:underline">
        ← Volver a Workspaces
      </Link>

      {schemaMissing ? (
        <div className="fo-card fo-alert-warning" role="alert">
          <p className="text-sm font-medium text-[var(--fo-text)]">Falta aplicar la migración en la base de datos</p>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            Las tablas del módulo (p. ej. <code className="text-xs">WorkspaceFeatureModule</code>) no
            existen todavía. Los toggles no pueden guardarse hasta que se apliquen las migraciones.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {availableModules.map((m) => {
          const enabled = enabledByModule.get(m.key) === true;
          return (
            <div key={m.key} className="fo-card space-y-3">
              <div>
                <h3 className="font-semibold text-[var(--fo-text)]">{m.label}</h3>
                <p className="text-xs text-[var(--fo-muted)] mt-1 leading-relaxed">{m.description}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--fo-border)]">
                <span
                  className={
                    "text-xs font-semibold " +
                    (enabled ? "text-[var(--fo-success)]" : "text-[var(--fo-muted)]")
                  }
                >
                  {enabled ? "● Activo" : "○ Inactivo"}
                </span>
                <WorkspaceModuleToggle
                  workspaceId={workspace.id}
                  moduleKey={m.key}
                  enabled={enabled}
                  disabled={schemaMissing}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
