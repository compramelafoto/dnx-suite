"use client";

import { usePathname } from "next/navigation";
import { LogOut, Repeat } from "lucide-react";
import { switchWorkspaceAction } from "@/app/actions/workspace";
import { fotofficeLogoutAction } from "@/app/actions/auth";
import { switchProfileAction } from "@/app/actions/profile-choice";
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
  canSwitchProfile,
  memberships,
  activeWorkspaceId,
}: {
  userName: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
  workspaceRole: string | null;
  workspaceLogoUrl: string | null;
  canSwitchProfile: boolean;
  memberships: { workspaceId: string; name: string }[];
  activeWorkspaceId: string | null;
}) {
  const pathname = usePathname() ?? "/workspace";
  // Con el menú oculto el encabezado también se ensancha: si quedara centrado en 6xl, el
  // contenido de abajo ocuparía toda la pantalla y el de arriba no, y se vería torcido.
  const { hidden } = useShellNav();
  const activa = memberships.find((m) => m.workspaceId === activeWorkspaceId) ?? memberships[0];
  const otras = memberships.filter((m) => m.workspaceId !== activa?.workspaceId);
  const nombre = userName || userEmail;
  const iniciales = nombre
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

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
            {otras.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {otras.map((m) => (
                  <form key={m.workspaceId} action={switchWorkspaceAction}>
                    <input type="hidden" name="workspaceId" value={m.workspaceId} />
                    <input type="hidden" name="next" value={pathname} />
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)] hover:border-[var(--fo-accent)] hover:text-[var(--fo-text)]"
                    >
                      Ir a {m.name}
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
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
          {userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- la foto vive en R2
            <img
              src={userAvatarUrl}
              alt=""
              className="size-10 shrink-0 rounded-full border border-[var(--fo-border)] object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--fo-accent-soft)] text-sm font-semibold text-[var(--fo-accent-hover)]"
            >
              {iniciales || "·"}
            </span>
          )}
          {canSwitchProfile ? (
            <form action={switchProfileAction}>
              <button
                type="submit"
                className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--fo-border)] text-[var(--fo-muted)] hover:border-[var(--fo-accent)] hover:text-[var(--fo-text)]"
                aria-label="Cambiar de perfil"
                title="Cambiar de perfil"
              >
                <Repeat className="size-4" aria-hidden />
              </button>
            </form>
          ) : null}
          <form action={fotofficeLogoutAction}>
            <button
              type="submit"
              className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--fo-border)] text-[var(--fo-muted)] hover:border-[var(--fo-danger-border)] hover:text-[var(--fo-danger)] md:w-auto md:gap-2 md:px-4"
              aria-label="Cerrar sesión"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden text-sm md:inline">Salir</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
