import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { getModuleLevels } from "@/lib/permissions/module-access";
import { manageFlagFor } from "@/lib/permissions/levels";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { personVocabulary } from "@/lib/vocabulario/personas";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellFrame } from "@/components/shell/shell-frame";
import { ShellHeader } from "@/components/shell/shell-header";
import { SHELL_NAV_COOKIE, parseShellNavPreference } from "@/lib/shell/nav-preference";
import { listUserProfiles } from "@/lib/portal/profiles";

type PanelUser = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  globalRole: string;
};

/**
 * El marco del panel administrativo: menú lateral, encabezado y contenido.
 *
 * Vive acá y no en un layout porque lo usan dos: el grupo `(shell)` (Socios, Caja, Sorteos…)
 * y `/workspace`, el inicio de la institución. Antes cada uno tenía el suyo y el inicio era el
 * pobre de los dos: otro menú, sin íconos, sin el selector de institución, y su "Inicio" no
 * era el mismo que el del resto del panel. Quien entraba veía dos sistemas distintos.
 *
 * El control de acceso lo hace quien lo monta, antes: cada layout tiene sus propias reglas
 * (el de `/workspace` además exige el alta terminada).
 */
export async function AdminShell({ user, children }: { user: PanelUser; children: React.ReactNode }) {
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
  const bookingsOn = enabledModuleKeys.has(BOOKINGS_MODULE_KEY);
  const rafflesOn = enabledModuleKeys.has(RAFFLES_MODULE_KEY);
  const coveragesOn = enabledModuleKeys.has(COVERAGES_MODULE_KEY);
  const websiteOn = enabledModuleKeys.has(WEBSITE_MODULE_KEY);
  const serviceLeadsOn = enabledModuleKeys.has(SERVICE_LEADS_MODULE_KEY);
  // El rol sigue alimentando el encabezado y Configuración (que no se delega). Los permisos
  // de cada módulo salen de un solo cálculo de niveles, el mismo que usan las páginas.
  const activeRole = workspace !== null ? await resolveWorkspaceRole(user.id, workspace.id) : null;
  const levels = workspace !== null ? await getModuleLevels(user.id, workspace.id) : {};
  const canManageWorkspaceSettingsFlag = canManageWorkspaceSettings(activeRole);
  const canManageMembersFlag = manageFlagFor(levels, MEMBERS_MODULE_KEY, false);
  const canManageBookingsFlag = manageFlagFor(levels, BOOKINGS_MODULE_KEY, false);
  const canManageRafflesFlag = manageFlagFor(levels, RAFFLES_MODULE_KEY, false);
  const platformAdmin = await isFotofficePlatformAdmin(user.id);
  // Sin workspace activo (recién invitado, todavía sin `ensure`) no hay fila que leer: el
  // vocabulario por omisión es lo correcto, ya que tampoco hay ningún módulo habilitado.
  const vocabulary =
    workspace !== null ? await loadPersonVocabulary(workspace.id) : personVocabulary(null);

  // Se lee acá, en el servidor, para que el menú ya salga oculto en el primer pintado:
  // decidirlo en el navegador lo mostraría y lo escondería en cada carga de página.
  const [branding, perfil, perfiles] = await Promise.all([
    workspace !== null
      ? prisma.fotofficeWorkspaceBranding.findUnique({
          where: { workspaceId: workspace.id },
          select: { commercialName: true, logoUrl: true },
        })
      : null,
    prisma.fotofficePhotographerProfile.findUnique({
      where: { userId: user.id },
      select: { displayName: true, avatarUrl: true },
    }),
    listUserProfiles(user.id),
  ]);
  const institucion = branding?.commercialName?.trim() || workspace?.name || null;

  const navHidden =
    parseShellNavPreference((await cookies()).get(SHELL_NAV_COOKIE)?.value) === "hidden";

  return (
    <ShellFrame
      navHidden={navHidden}
      sidebar={
        <ShellSidebar
          workspaceName={institucion}
          coursesEnabled={coursesOn}
          evaluacionesEnabled={evaluacionesOn}
          membersEnabled={membersOn}
          bookingsEnabled={bookingsOn}
          rafflesEnabled={rafflesOn}
          coveragesEnabled={coveragesOn}
          websiteEnabled={websiteOn}
          serviceLeadsEnabled={serviceLeadsOn}
          canManageMembers={canManageMembersFlag}
          canManageBookings={canManageBookingsFlag}
          canManageRaffles={canManageRafflesFlag}
          canManageWorkspaceSettings={canManageWorkspaceSettingsFlag}
          platformAdmin={platformAdmin}
          vocabulary={vocabulary}
        />
      }
      header={
        <ShellHeader
          userName={perfil?.displayName ?? user.name}
          userAvatarUrl={perfil?.avatarUrl ?? null}
          workspaceRole={activeRole}
          workspaceLogoUrl={branding?.logoUrl ?? null}
          canSwitchProfile={perfiles.length > 1}
          userEmail={user.email}
          memberships={memberships.map((m) => ({
            workspaceId: m.workspaceId,
            name: m.workspaceId === workspace?.id && institucion ? institucion : m.workspace.name,
          }))}
          activeWorkspaceId={workspace?.id ?? null}
        />
      }
    >
      {children}
    </ShellFrame>
  );
}
