import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { CreateOwnerUserForm, UpdateGlobalRoleForm } from "@/components/super-admin-forms";

export default async function SuperAdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { id: "desc" },
    select: { id: true, email: true, role: true, name: true, isBlocked: true },
    take: 200,
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Usuarios"
        description="Creación de owners y gestión de roles globales de Fotoffice."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <CreateOwnerUserForm />
        <UpdateGlobalRoleForm users={users.map((u) => ({ ...u, role: String(u.role) }))} />
      </div>

      <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
        <table className="w-full text-sm text-left min-w-[720px]">
          <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Rol global</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                <td className="px-4 py-3 font-medium text-[var(--fo-text)]">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--fo-muted)]">{u.email}</td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-[var(--fo-code-bg)] px-1.5 py-0.5 rounded border border-[var(--fo-border)]">
                    {u.role}
                  </code>
                </td>
                <td className="px-4 py-3 text-[var(--fo-muted)]">
                  {u.isBlocked ? (
                    <span className="text-[var(--fo-danger)]">Bloqueado</span>
                  ) : (
                    <span className="text-[var(--fo-success)]">Activo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
