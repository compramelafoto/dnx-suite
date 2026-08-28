import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { hasAppAccess, requireAuth } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { canManageMembers } from "@/lib/members/role-policy";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellFrame } from "@/components/shell/shell-frame";
import { ShellHeader } from "@/components/shell/shell-header";
import { SHELL_NAV_COOKIE, parseShellNavPreference } from "@/lib/shell/nav-preference";
import { PORTAL_HOME } from "@/lib/portal/destination";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!hasAppAccess(user, "FOTOFFICE")) {
    redirect("/login?forbiddenApp=fotoffice");
  }
  // Un socio no entra al panel administrativo: su lugar es el portal.
  if ((await resolveFotofficeUserKind(user.id)) === "MEMBER") redirect(PORTAL_HOME);
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
  const enabledModuleKeys =
    workspace !== null ? await getEnabledModuleKeysForWorkspace(workspace.id) : new Set<string>();
  const coursesOn = enabledModuleKeys.has(COURSES_SALES_MODULE_KEY);
  const evaluacionesOn = enabledModuleKeys.has(EVALUACIONES_MODULE_KEY);
  const membersOn = enabledModuleKeys.has(MEMBERS_MODULE_KEY);
  const websiteOn = enabledModuleKeys.has(WEBSITE_MODULE_KEY);
  const activeMembership = memberships.find((m) => m.workspaceId === workspace?.id);
  const canManageMembersFlag = canManageMembers(activeMembership?.role);
  const canManageWorkspaceSettingsFlag = canManageWorkspaceSettings(activeMembership?.role);
  const platformAdmin = await isFotofficePlatformAdmin(user.id);

  // Se lee acá, en el servidor, para que el menú ya salga oculto en el primer pintado:
  // decidirlo en el navegador lo mostraría y lo escondería en cada carga de página.
  const navHidden =
    parseShellNavPreference((await cookies()).get(SHELL_NAV_COOKIE)?.value) === "hidden";

  return (
    <ShellFrame
      navHidden={navHidden}
      sidebar={
        <ShellSidebar
          workspaceName={workspace?.name ?? null}
          coursesEnabled={coursesOn}
          evaluacionesEnabled={evaluacionesOn}
          membersEnabled={membersOn}
          websiteEnabled={websiteOn}
          canManageMembers={canManageMembersFlag}
          canManageWorkspaceSettings={canManageWorkspaceSettingsFlag}
          platformAdmin={platformAdmin}
        />
      }
      header={
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
      }
    >
      {children}
    </ShellFrame>
  );
}
