"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Shield,
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
  platformAdmin,
}: {
  coursesEnabled: boolean;
  platformAdmin: boolean;
}) {
  const path = usePathname() ?? "";

  const isCoursesMain =
    path === "/dashboard/courses" ||
    path.startsWith("/dashboard/courses/new") ||
    /^\/dashboard\/courses\/[^/]+$/.test(path) ||
    path === "/courses" ||
    path.startsWith("/courses/new") ||
    /^\/courses\/[^/]+\/edit$/.test(path);
  const isSales = path.startsWith("/dashboard/sales");
  const isTeachers = path.startsWith("/courses/teachers");
  const isLeads = path.startsWith("/courses/leads");
  const isCourseSettings = path.startsWith("/courses/settings");

  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      <Link href="/dashboard" className={navClass(path === "/dashboard")}>
        <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
        Inicio
      </Link>
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
          <Link
            href="/admin/workspace-modules"
            className={navClass(path.startsWith("/admin/workspace-modules"))}
          >
            <LayoutGrid className="size-4 shrink-0 opacity-80" aria-hidden />
            Módulos
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
