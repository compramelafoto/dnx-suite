import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { getModuleLevels, hasModuleAction } from "@/lib/permissions/module-access";
import { CASH_CONFIGURE_ACTION, COVERAGES_COORDINATE_ACTION } from "@/lib/permissions/actions";
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
  // El rol sigue alimentando el encabezado y la sección Institución (Configuración no se
  // delega). Qué módulos y qué pantallas aparecen sale de un solo cálculo de niveles, el mismo
  // que usan las páginas: un módulo apagado ya viene en NONE.
  const activeRole = workspace !== null ? await resolveWorkspaceRole(user.id, workspace.id) : null;
  const levels = workspace !== null ? await getModuleLevels(user.id, workspace.id) : {};
  const canManageWorkspaceSettingsFlag = canManageWorkspaceSettings(activeRole);
  // Las acciones sensibles que alguna entrada del menú exige. Se calculan acá, en el servidor:
  // el menú es un componente de cliente y sólo recibe la lista ya resuelta.
  const [puedeConfigurarCaja, puedeCoordinarCoberturas] =
    workspace !== null
      ? await Promise.all([
          hasModuleAction(user.id, workspace.id, CASH_MODULE_KEY, CASH_CONFIGURE_ACTION),
          hasModuleAction(user.id, workspace.id, COVERAGES_MODULE_KEY, COVERAGES_COORDINATE_ACTION),
        ])
      : [false, false];
  const actions = [
    ...(puedeConfigurarCaja ? [CASH_CONFIGURE_ACTION] : []),
    ...(puedeCoordinarCoberturas ? [COVERAGES_COORDINATE_ACTION] : []),
  ];
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
          levels={levels}
          actions={actions}
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
