import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { hasAppAccess, requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { resolveEnabledNavModules } from "@/lib/modules/nav";
import { PORTAL_HOME } from "@/lib/portal/destination";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  // Frontera con el portal del socio, ANTES de `ensure`: esa función le crearía una
  // institución propia —con rol de dueño— a quien solo es socio de otra.
  if ((await resolveFotofficeUserKind(user.id)) === "MEMBER") redirect(PORTAL_HOME);

  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId },
    },
    select: { role: true },
  });
  const workspaceRole = membership?.role ?? user.workspaceRole;
  const canAccess =
    user.globalRole === "SUPER_ADMIN" ||
    Boolean(membership) ||
    hasAppAccess({ ...user, workspaceRole }, "FOTOFFICE");
  if (!canAccess) {
    redirect("/login?forbiddenApp=fotoffice");
  }

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: ensured.workspaceId },
    select: { commercialName: true, onboardingCompletedAt: true },
  });

  if (!branding?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const profile = await prisma.fotofficePhotographerProfile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, avatarUrl: true },
  });

  const workspaces = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    select: { workspaceId: true, workspace: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const enabledModuleKeys = await getEnabledModuleKeysForWorkspace(ensured.workspaceId);
  const navModules = resolveEnabledNavModules(enabledModuleKeys);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--fo-bg)]">
      <header className="border-b border-[var(--fo-border)] bg-[var(--fo-surface)]">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/workspace" className="inline-flex rounded-xl bg-white px-3 py-2 shrink-0">
              <FotofficeLogo variant="compact" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">Negocio</p>
              <p className="font-semibold text-[var(--fo-text)] truncate">
                {branding?.commercialName ?? "Mi estudio"}
              </p>
            </div>
            {workspaces.length > 1 ? (
              <label className="text-sm text-[var(--fo-muted)]">
                <span className="sr-only">Workspace</span>
                <select
                  className="rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
                  defaultValue={ensured.workspaceId}
                  disabled
                  title="Selector preparado para múltiples workspaces"
                >
                  {workspaces.map((w) => (
                    <option key={w.workspaceId} value={w.workspaceId}>
                      {w.workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-[var(--fo-text)]">
                {profile?.displayName ?? user.name ?? "Fotógrafo"}
              </p>
              <p className="text-xs text-[var(--fo-muted)]">{user.email}</p>
            </div>
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                className="size-10 rounded-full object-cover border border-[var(--fo-border)]"
              />
            ) : (
              <div className="size-10 rounded-full bg-[var(--fo-border)]" aria-hidden />
            )}
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="fo-btn fo-btn-secondary text-sm min-h-10">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl w-full px-4 md:px-6 py-8 flex flex-col lg:flex-row gap-8 lg:gap-10">
        <nav className="lg:w-64 shrink-0 space-y-2" aria-label="Workspace">
          <Link
            href="/workspace"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-[var(--fo-text)] hover:bg-[var(--fo-surface)] border border-transparent hover:border-[var(--fo-border)]"
          >
            Inicio
          </Link>
          {navModules.map((m) => (
            <Link
              key={m.key}
              href={m.route}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-[var(--fo-text)] hover:bg-[var(--fo-surface)] border border-transparent hover:border-[var(--fo-border)]"
            >
              {m.label}
            </Link>
          ))}
          <Link
            href="/workspace/configuracion"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-[var(--fo-text)] hover:bg-[var(--fo-surface)] border border-transparent hover:border-[var(--fo-border)]"
          >
            Configuración
          </Link>
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
