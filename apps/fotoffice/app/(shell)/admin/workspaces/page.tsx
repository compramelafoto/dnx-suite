import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { CreateWorkspaceForm } from "@/components/super-admin-forms";

export default async function SuperAdminWorkspacesPage() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    include: { memberships: true },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Workspaces"
        description="Alta y supervisión de workspaces de toda la plataforma."
      />
      <CreateWorkspaceForm />

      <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Owners</th>
              <th className="px-4 py-3 font-semibold">Miembros</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
            {workspaces.map((w) => {
              const owners = w.memberships.filter((m) => m.role === "ADMIN").length;
              return (
                <tr key={w.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                  <td className="px-4 py-3 font-medium text-[var(--fo-text)]">{w.name}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{owners}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{w.memberships.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
