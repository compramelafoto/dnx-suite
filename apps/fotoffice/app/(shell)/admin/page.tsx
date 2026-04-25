import Link from "next/link";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { LayoutGrid, Settings, Shield, Users, Building2, UserCog } from "lucide-react";

export default async function AdminHubPage() {
  const sessionUser = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true, email: true, name: true },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Super Admin global"
        description="Administración central de Fotoffice: workspaces, usuarios, dueños, módulos y configuración global."
      />

      <div className="fo-card border-[var(--fo-accent)]/25 bg-[var(--fo-accent)]/5">
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          Sesión:{" "}
          <span className="text-[var(--fo-text)] font-medium">{user?.name ?? user?.email}</span>
          {user?.role ? (
            <>
              {" "}
              · Rol: <span className="font-mono text-xs">{user.role}</span>
            </>
          ) : null}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link
            href="/admin/workspaces"
            className="fo-card flex gap-4 items-start h-full transition-colors hover:border-[var(--fo-accent)]/40 hover:bg-[var(--fo-surface-hover)]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
              <Building2 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-[var(--fo-text)]">Workspaces</p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                Crear y revisar workspaces de toda la plataforma.
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/users"
            className="fo-card flex gap-4 items-start h-full transition-colors hover:border-[var(--fo-accent)]/40 hover:bg-[var(--fo-surface-hover)]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
              <Users className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-[var(--fo-text)]">Usuarios</p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                Crear owners y actualizar roles globales.
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/owners"
            className="fo-card flex gap-4 items-start h-full transition-colors hover:border-[var(--fo-accent)]/40 hover:bg-[var(--fo-surface-hover)]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
              <UserCog className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-[var(--fo-text)]">Dueños</p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                Asignar owners a cada workspace (membership ADMIN).
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/workspace-modules"
            className="fo-card flex gap-4 items-start h-full transition-colors hover:border-[var(--fo-accent)]/40 hover:bg-[var(--fo-surface-hover)]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
              <LayoutGrid className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-[var(--fo-text)]">Módulos por workspace</p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                Activá o desactivá el módulo de venta de cursos (`courses-sales`) por workspace.
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/settings"
            className="fo-card flex gap-4 items-start h-full transition-colors hover:border-[var(--fo-accent)]/40 hover:bg-[var(--fo-surface-hover)]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
              <Settings className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-[var(--fo-text)]">Configuración global</p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                Estado de conexión y parámetros globales de plataforma.
              </p>
            </div>
          </Link>
        </li>
        <li className="fo-card flex gap-4 items-start h-full opacity-80">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Shield className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-[var(--fo-text)]">Guard de seguridad</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Solo usuarios con rol global <code className="text-xs">SUPER_ADMIN</code> acceden a esta
              sección.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
