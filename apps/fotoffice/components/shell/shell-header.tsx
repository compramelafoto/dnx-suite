"use client";

import type { AccountMenu as AccountMenuData, RoleSelector as RoleSelectorData } from "@/lib/portal/profiles";
import { AccountMenu } from "./account-menu";
import { NavToggle } from "./nav-toggle";
import { useShellNav } from "./shell-frame";

/** El rol en el idioma de quien lo lee. Antes se mostraba `SUPER_ADMIN · WORKSPACE_OWNER`. */
const ROLES: Record<string, string> = {
  WORKSPACE_OWNER: "Dueño",
  WORKSPACE_ADMIN: "Administrador",
  STAFF: "Equipo",
  COLLABORATOR: "Colaborador",
};

/**
 * El encabezado del panel: de qué institución es este panel, a la izquierda; quién está
 * mirando, a la derecha.
 *
 * La institución va con su logo y grande: es lo que dice "estás administrando la SFPR" y no
 * otra cosa. Con varias instituciones, se elige acá.
 */
export function ShellHeader({
  userName,
  userEmail,
  userAvatarUrl,
  workspaceRole,
  workspaceLogoUrl,
  menu,
  roleSelector,
  memberships,
  activeWorkspaceId,
}: {
  userName: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
  workspaceRole: string | null;
  workspaceLogoUrl: string | null;
  menu: AccountMenuData;
  roleSelector: RoleSelectorData | null;
  memberships: { workspaceId: string; name: string }[];
  activeWorkspaceId: string | null;
}) {
  // Con el menú oculto el encabezado también se ensancha: si quedara centrado en 6xl, el
  // contenido de abajo ocuparía toda la pantalla y el de arriba no, y se vería torcido.
  const { hidden } = useShellNav();
  const activa = memberships.find((m) => m.workspaceId === activeWorkspaceId) ?? memberships[0];
  const nombre = userName || userEmail;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]/90 px-4 py-3 backdrop-blur-md md:px-8">
      <div
        className={[
          "mx-auto flex w-full items-center justify-between gap-4",
          hidden ? "max-w-none" : "max-w-6xl",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <NavToggle variant="header" />
          {workspaceLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
            <img
              src={workspaceLogoUrl}
              alt=""
              className="h-10 w-auto max-w-28 shrink-0 object-contain md:h-14 md:max-w-40"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fo-muted-soft)]">
              Panel de la institución
            </p>
            {activa ? (
              <p className="truncate text-base font-semibold text-[var(--fo-text)] md:text-lg">{activa.name}</p>
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">Sin institución asignada</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
            <p className="max-w-[14rem] truncate text-sm font-medium text-[var(--fo-text)]">{nombre}</p>
            <p className="max-w-[14rem] truncate text-xs text-[var(--fo-muted)]">
              {workspaceRole && ROLES[workspaceRole] ? `${ROLES[workspaceRole]} · ` : ""}
              {userEmail}
            </p>
          </div>
          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            userAvatarUrl={userAvatarUrl}
            menu={menu}
            roleSelector={roleSelector}
          />
        </div>
      </div>
    </header>
  );
}
