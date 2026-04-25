import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { hasAppAccess, requireAuth } from "@/lib/auth";
import {
  isCoursesSalesEnabledForWorkspace,
  resolveActiveWorkspace,
} from "@/lib/workspace";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellHeader } from "@/components/shell/shell-header";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!hasAppAccess(user, "FOTOFFICE")) {
    redirect("/login?forbiddenApp=fotoffice");
  }
  const unifiedMemberships = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  const memberships =
    unifiedMemberships.length > 0
      ? unifiedMemberships
      : await prisma.membership.findMany({
          where: { userId: user.id },
          include: { workspace: true },
          orderBy: { id: "asc" },
        });
  const workspace = await resolveActiveWorkspace(user.id);
  const coursesOn =
    workspace !== null ? await isCoursesSalesEnabledForWorkspace(workspace.id) : false;
  const platformAdmin = await isFotofficePlatformAdmin(user.id);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--fo-bg)]">
      <ShellSidebar coursesEnabled={coursesOn} platformAdmin={platformAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <ShellHeader
          userName={user.name}
          userEmail={user.email}
          userRole={user.role}
          userGlobalRole={user.globalRole}
          memberships={memberships.map((m) => ({
            workspaceId: m.workspaceId,
            name: m.workspace.name,
          }))}
          activeWorkspaceId={workspace?.id ?? null}
        />
        <main className="flex-1 p-6 md:p-10 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
