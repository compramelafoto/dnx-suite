"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { switchWorkspaceAction } from "@/app/actions/workspace";
import { fotofficeLogoutAction } from "@/app/actions/auth";

export function ShellHeader({
  userName,
  userEmail,
  userRole,
  userGlobalRole,
  memberships,
  activeWorkspaceId,
}: {
  userName: string | null;
  userEmail: string;
  userRole: string;
  userGlobalRole: string;
  memberships: { workspaceId: string; name: string }[];
  activeWorkspaceId: string | null;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const suiteLogoutBtnClass =
    "inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--fo-accent)]/35 bg-[var(--fo-accent-muted)] px-3 text-sm font-medium text-[var(--fo-accent)] transition-colors hover:bg-[var(--fo-accent)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-accent)]/45";

  return (
    <header className="border-b border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]/80 backdrop-blur-md px-4 py-4 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between max-w-6xl mx-auto w-full">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--fo-muted-soft)]">
            Workspace activo
          </p>
          {memberships.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Sin workspaces asignados.</p>
          ) : memberships.length === 1 ? (
            <p className="text-sm font-semibold text-[var(--fo-text)] truncate">
              {memberships[0]!.name}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {memberships.map((m) => (
                <form key={m.workspaceId} action={switchWorkspaceAction} className="inline">
                  <input type="hidden" name="workspaceId" value={m.workspaceId} />
                  <input type="hidden" name="next" value={pathname} />
                  <button
                    type="submit"
                    className={
                      m.workspaceId === activeWorkspaceId
                        ? "fo-btn fo-btn-primary text-xs min-h-9 px-3"
                        : "fo-btn fo-btn-secondary text-xs min-h-9 px-3"
                    }
                  >
                    {m.name}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <div className="text-right min-w-0">
            <p className="text-sm font-medium text-[var(--fo-text)] truncate max-w-[14rem] md:max-w-xs">
              {userName || userEmail}
            </p>
            <p className="text-xs text-[var(--fo-muted)] truncate max-w-[14rem] md:max-w-xs">
              {userEmail}
            </p>
            <p className="text-[10px] text-[var(--fo-muted-soft)] font-mono uppercase tracking-wide truncate max-w-[14rem] md:max-w-xs">
              {userGlobalRole} · {userRole}
            </p>
          </div>
          <form action={fotofficeLogoutAction}>
            <button type="submit" className={suiteLogoutBtnClass} aria-label="Cerrar sesión">
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
