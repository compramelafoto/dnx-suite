"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Globe,
  GraduationCap,
  IdCard,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Shield,
  Tag,
  Wallet,
  UserCog,
  Users,
} from "lucide-react";

function navClass(active: boolean) {
  return [
    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
      : "text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]",
  ].join(" ");
}

export function ShellNav({
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
  const path = usePathname() ?? "";

  const isWebsite = path === "/website" || path.startsWith("/website/");
  const isCoursesMain =
    path === "/dashboard/courses" ||
    path.startsWith("/dashboard/courses/new") ||
    /^\/dashboard\/courses\/[^/]+$/.test(path) ||
    path === "/courses" ||
    path.startsWith("/courses/new") ||
    /^\/courses\/[^/]+\/edit$/.test(path);
  const isSales = path.startsWith("/dashboard/sales");
  const isEvaluaciones = path === "/evaluaciones" || path.startsWith("/evaluaciones/");
  const isTeachers = path.startsWith("/courses/teachers");
  const isLeads = path.startsWith("/courses/leads");
  const isCourseSettings = path.startsWith("/courses/settings");
  const isMembersMain = path === "/members" || (path.startsWith("/members/") && !path.startsWith("/members/categories"));
  const isMemberCategories = path.startsWith("/members/categories");

  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      <Link href="/dashboard" className={navClass(path === "/dashboard")}>
        <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
        Inicio
      </Link>
      {canManageWorkspaceSettings ? (
        <Link
          href="/workspace/configuracion"
          className={navClass(path.startsWith("/workspace/configuracion"))}
        >
          <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
          Configuración
        </Link>
      ) : null}
      {coursesEnabled ? (
        <>
          <Link href="/dashboard/courses" className={navClass(isCoursesMain)}>
            <GraduationCap className="size-4 shrink-0 opacity-80" aria-hidden />
            Cursos presenciales
          </Link>
          <Link href="/dashboard/sales" className={navClass(isSales)}>
            <LayoutGrid className="size-4 shrink-0 opacity-80" aria-hidden />
            Ventas
          </Link>
          <Link href="/courses/teachers" className={navClass(isTeachers)}>
            <Users className="size-4 shrink-0 opacity-80" aria-hidden />
            Docentes
          </Link>
          <Link href="/courses/leads" className={navClass(isLeads)}>
            <Inbox className="size-4 shrink-0 opacity-80" aria-hidden />
            Inscripciones
          </Link>
          <Link href="/courses/settings" className={navClass(isCourseSettings)}>
            <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
            Config. del módulo
          </Link>
        </>
      ) : null}
      {evaluacionesEnabled ? (
        <Link href="/evaluaciones" className={navClass(isEvaluaciones)}>
          <LayoutGrid className="size-4 shrink-0 opacity-80" aria-hidden />
          Evaluaciones
        </Link>
      ) : null}
      {membersEnabled ? (
        <>
          <Link href="/members" className={navClass(isMembersMain)}>
            <IdCard className="size-4 shrink-0 opacity-80" aria-hidden />
            Socios
          </Link>
          {canManageMembers ? (
            <>
              <Link href="/members/cuotas" className={navClass(path.startsWith("/members/cuotas"))}>
                <Wallet className="size-4 shrink-0 opacity-80" aria-hidden />
                Cuotas
              </Link>
              <Link href="/members/categories" className={navClass(isMemberCategories)}>
                <Tag className="size-4 shrink-0 opacity-80" aria-hidden />
                Categorías de socios
              </Link>
            </>
          ) : null}
        </>
      ) : null}
      {websiteEnabled ? (
        <Link href="/website" className={navClass(isWebsite)}>
          <Globe className="size-4 shrink-0 opacity-80" aria-hidden />
          Sitio web
        </Link>
      ) : null}
      {platformAdmin ? (
        <>
          <Link href="/admin" className={navClass(path === "/admin")}>
            <Shield className="size-4 shrink-0 opacity-80" aria-hidden />
            Administración
          </Link>
          <Link href="/admin/workspaces" className={navClass(path.startsWith("/admin/workspaces"))}>
            <Building2 className="size-4 shrink-0 opacity-80" aria-hidden />
            Workspaces
          </Link>
          <Link href="/admin/users" className={navClass(path.startsWith("/admin/users"))}>
            <Users className="size-4 shrink-0 opacity-80" aria-hidden />
            Usuarios
          </Link>
          <Link href="/admin/owners" className={navClass(path.startsWith("/admin/owners"))}>
            <UserCog className="size-4 shrink-0 opacity-80" aria-hidden />
            Dueños
          </Link>
          <Link href="/admin/settings" className={navClass(path.startsWith("/admin/settings"))}>
            <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
            Configuración global
          </Link>
        </>
      ) : null}
    </nav>
  );
}
