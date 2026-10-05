import Link from "next/link";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { NavToggle } from "./nav-toggle";
import { ShellNav } from "./shell-nav";
import { RoleSelector } from "./role-selector";
import type { RoleSelector as RoleSelectorData } from "@/lib/portal/profiles";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import type { ModuleLevels } from "@/lib/permissions/levels";

export function ShellSidebar({
  workspaceName,
  levels,
  actions,
  canManageWorkspaceSettings,
  platformAdmin,
  vocabulary,
  roleSelector = null,
}: {
  /**
   * Nombre de la organización activa. Antes acá decía "Venta de cursos", fijo en el código:
   * una asociación con el módulo de cursos apagado leía debajo de su logo el nombre de un
   * módulo que no tiene.
   */
  workspaceName: string | null;
  /** Nivel en cada módulo, de `getModuleLevels`. Un módulo apagado viene en NONE. */
  levels: ModuleLevels;
  /** Acciones sensibles vigentes que el menú necesita (`cash.configure`, `coverages.coordinate`). */
  actions: readonly string[];
  /** Sólo para la sección Institución: Configuración no se delega. */
  canManageWorkspaceSettings: boolean;
  platformAdmin: boolean;
  vocabulary: PersonVocabulary;
  /** Socio y equipo en esta institución: el selector de rol (Comisión/Administración activo). */
  roleSelector?: RoleSelectorData | null;
}) {
  return (
    <aside className="min-h-full md:min-h-screen border-b md:border-b-0 md:border-r border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-4 md:p-5">
      <div className="mb-8 flex items-start justify-between gap-2">
        <Link
          href="/workspace"
          className="block min-w-0 rounded-[var(--fo-radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
        >
          <span className="sr-only">Fotoffice — ir al inicio</span>
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
      {/* En el teléfono esto está dentro del cajón del menú, que ya contiene esta barra. */}
      <RoleSelector selector={roleSelector} className="mb-6" />
      <ShellNav
        levels={levels}
        actions={actions}
        canManageWorkspaceSettings={canManageWorkspaceSettings}
        platformAdmin={platformAdmin}
        vocabulary={vocabulary}
      />
    </aside>
  );
}
