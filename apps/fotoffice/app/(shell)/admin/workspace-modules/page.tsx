import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { WorkspaceModuleToggle } from "@/components/workspace-module-toggle";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { isMissingCoursesSalesSchemaError } from "@/lib/courses-sales/prisma-errors";

export default async function AdminWorkspaceModulesPage() {
  type Row = {
    id: string;
    name: string;
    featureModules: { moduleKey: string; enabled: boolean }[];
    fotofficeBranding: { publicSlug: string } | null;
  };

  let workspaces: Row[];
  let schemaMissing = false;
  try {
    workspaces = await prisma.workspace.findMany({
      orderBy: { name: "asc" },
      include: {
        featureModules: {
            where: { moduleKey: { in: [COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY] } },
            select: { moduleKey: true, enabled: true },
        },
        fotofficeBranding: { select: { publicSlug: true } },
      },
    });
  } catch (e) {
    if (!isMissingCoursesSalesSchemaError(e)) throw e;
    schemaMissing = true;
    const basic = await prisma.workspace.findMany({ orderBy: { name: "asc" } });
    workspaces = basic.map((w) => ({
      id: w.id,
      name: w.name,
      featureModules: [],
      fotofficeBranding: null,
    }));
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Módulos por workspace"
        description={`Activá o desactivá los módulos «${COURSES_SALES_MODULE_KEY}» y «${EVALUACIONES_MODULE_KEY}» para cada workspace. Solo SUPER_ADMIN global.`}
      />

      {schemaMissing ? (
        <div
          className="fo-card fo-alert-warning"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--fo-text)]">Falta aplicar la migración en la base de datos</p>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            Las tablas del módulo (p. ej. <code className="text-xs">WorkspaceFeatureModule</code>) no
            existen. Ejecutá el SQL de{" "}
            <code className="text-xs">
              packages/db/prisma/migrations/20260331230000_fotoffice_courses_sales/migration.sql
            </code>{" "}
            en tu Postgres (Neon consola SQL), o alineá el historial de Prisma y usá{" "}
            <code className="text-xs">pnpm --filter @repo/db exec prisma migrate deploy</code>.
          </p>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            Hasta entonces los toggles no pueden guardarse y el listado solo muestra nombres de workspace.
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Workspace</th>
              <th className="px-4 py-3 font-semibold">Slug público</th>
              <th className="px-4 py-3 font-semibold">Cursos sales</th>
              <th className="px-4 py-3 font-semibold w-36" />
              <th className="px-4 py-3 font-semibold">Evaluaciones</th>
              <th className="px-4 py-3 font-semibold w-36" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
            {workspaces.map((w) => {
              const enabledByModule = new Map(w.featureModules.map((fm) => [fm.moduleKey, fm.enabled]));
              const coursesEnabled = enabledByModule.get(COURSES_SALES_MODULE_KEY) === true;
              const evaluacionesEnabled = enabledByModule.get(EVALUACIONES_MODULE_KEY) === true;
              return (
                <tr key={w.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                  <td className="px-4 py-3 font-medium text-[var(--fo-text)]">{w.name}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)] font-mono text-xs">
                    {w.fotofficeBranding?.publicSlug ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {coursesEnabled ? (
                      <span className="text-[var(--fo-success)] font-medium">Activo</span>
                    ) : (
                      <span>Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <WorkspaceModuleToggle
                      workspaceId={w.id}
                      moduleKey={COURSES_SALES_MODULE_KEY}
                      enabled={coursesEnabled}
                      disabled={schemaMissing}
                    />
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {evaluacionesEnabled ? (
                      <span className="text-[var(--fo-success)] font-medium">Activo</span>
                    ) : (
                      <span>Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <WorkspaceModuleToggle
                      workspaceId={w.id}
                      moduleKey={EVALUACIONES_MODULE_KEY}
                      enabled={evaluacionesEnabled}
                      disabled={schemaMissing}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
