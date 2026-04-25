import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { AssignOwnerForm } from "@/components/super-admin-forms";

export default async function SuperAdminOwnersPage() {
  const [users, workspaces, ownerMemberships] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
      take: 500,
    }),
    prisma.workspace.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: { role: "ADMIN" },
      orderBy: { id: "asc" },
      include: {
        user: { select: { email: true, name: true } },
        workspace: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dueños (Owners)"
        description="Asignación de owners por workspace (membership ADMIN)."
      />

      <AssignOwnerForm users={users} workspaces={workspaces} />

      <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
        <table className="w-full text-sm text-left min-w-[720px]">
          <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Workspace</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
            {ownerMemberships.map((m) => (
              <tr key={m.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                <td className="px-4 py-3 font-medium text-[var(--fo-text)]">{m.workspace.name}</td>
                <td className="px-4 py-3 text-[var(--fo-muted)]">{m.user.name ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--fo-muted)]">{m.user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
