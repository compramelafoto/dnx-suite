import Link from "next/link";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { NavToggle } from "./nav-toggle";
import { ShellNav } from "./shell-nav";

export function ShellSidebar({
  workspaceName,
  coursesEnabled,
  evaluacionesEnabled,
  membersEnabled,
  websiteEnabled,
  canManageMembers,
  canManageWorkspaceSettings,
  platformAdmin,
}: {
  /**
   * Nombre de la organización activa. Antes acá decía "Venta de cursos", fijo en el código:
   * una asociación con el módulo de cursos apagado leía debajo de su logo el nombre de un
   * módulo que no tiene.
   */
  workspaceName: string | null;
  coursesEnabled: boolean;
  evaluacionesEnabled: boolean;
  membersEnabled: boolean;
  websiteEnabled: boolean;
  canManageMembers: boolean;
  canManageWorkspaceSettings: boolean;
  platformAdmin: boolean;
}) {
  return (
    <aside className="min-h-full md:min-h-screen border-b md:border-b-0 md:border-r border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-4 md:p-5">
      <div className="mb-8 flex items-start justify-between gap-2">
        <Link
          href="/dashboard"
          className="block min-w-0 rounded-[var(--fo-radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
        >
          <span className="sr-only">Fotoffice — ir al panel</span>
          <div className="px-0 py-1 md:py-2">
            <FotofficeLogo variant="sidebar" />
          </div>
          {workspaceName ? (
            <span className="block truncate text-xs text-[var(--fo-muted)] mt-2.5">
              {workspaceName}
            </span>
          ) : null}
        </Link>
        <NavToggle variant="sidebar" />
      </div>
      <ShellNav
        coursesEnabled={coursesEnabled}
        evaluacionesEnabled={evaluacionesEnabled}
        membersEnabled={membersEnabled}
        websiteEnabled={websiteEnabled}
        canManageMembers={canManageMembers}
        canManageWorkspaceSettings={canManageWorkspaceSettings}
        platformAdmin={platformAdmin}
      />
    </aside>
  );
}
