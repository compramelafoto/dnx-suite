import Link from "next/link";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { ShellNav } from "./shell-nav";

export function ShellSidebar({
  coursesEnabled,
  evaluacionesEnabled,
  membersEnabled,
  websiteEnabled,
  canManageMembers,
  canManageWorkspaceSettings,
  platformAdmin,
}: {
  coursesEnabled: boolean;
  evaluacionesEnabled: boolean;
  membersEnabled: boolean;
  websiteEnabled: boolean;
  canManageMembers: boolean;
  canManageWorkspaceSettings: boolean;
  platformAdmin: boolean;
}) {
  return (
    <aside className="border-b md:border-b-0 md:border-r border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] md:w-72 md:shrink-0 md:min-h-screen p-4 md:p-5">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="block rounded-[var(--fo-radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
        >
          <span className="sr-only">Fotoffice — ir al panel</span>
          <div className="px-0 py-1 md:py-2">
            <FotofficeLogo variant="sidebar" />
          </div>
          <span className="block text-xs text-[var(--fo-muted)] mt-2.5">Venta de cursos</span>
        </Link>
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
      <div className="mt-8 border-t border-[var(--fo-border)] pt-6 space-y-2">
        <p className="px-3 text-[10px] font-medium uppercase tracking-wider text-[var(--fo-muted-soft)]">
          Captación de clientes
        </p>
        <Link
          href="/dashboard/service-leads/forms"
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
        >
          Formularios
        </Link>
        <Link
          href="/dashboard/service-leads"
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
        >
          Leads
        </Link>
      </div>
    </aside>
  );
}
