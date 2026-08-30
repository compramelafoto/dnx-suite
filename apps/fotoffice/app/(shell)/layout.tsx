import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { requireFotofficePanelUser } from "@/lib/shell/require-fotoffice-access";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { canManageMembers } from "@/lib/members/role-policy";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellFrame } from "@/components/shell/shell-frame";
import { ShellHeader } from "@/components/shell/shell-header";
import { SHELL_NAV_COOKIE, parseShellNavPreference } from "@/lib/shell/nav-preference";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFotofficePanelUser();
  // Solo `workspaceMembership`: sin respaldo a la tabla legacy. El menú tiene que
  // ofrecer exactamente lo que las páginas aceptan, y las páginas leen de acá
  // (ver `lib/workspace-role.ts`).
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  const workspace = await resolveActiveWorkspace(user.id);
  const enabledModuleKeys =
    workspace !== null ? await getEnabledModuleKeysForWorkspace(workspace.id) : new Set<string>();
  const coursesOn = enabledModuleKeys.has(COURSES_SALES_MODULE_KEY);
  const evaluacionesOn = enabledModuleKeys.has(EVALUACIONES_MODULE_KEY);
  const membersOn = enabledModuleKeys.has(MEMBERS_MODULE_KEY);
  const websiteOn = enabledModuleKeys.has(WEBSITE_MODULE_KEY);
  // Un solo rol resuelto alimenta los dos flags del menú: si se resolvieran por caminos
  // distintos, volvería a poder pasar que uno ofrezca lo que el otro niega.
  const activeRole = workspace !== null ? await resolveWorkspaceRole(user.id, workspace.id) : null;
  const canManageMembersFlag = canManageMembers(activeRole);
  const canManageWorkspaceSettingsFlag = canManageWorkspaceSettings(activeRole);
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
