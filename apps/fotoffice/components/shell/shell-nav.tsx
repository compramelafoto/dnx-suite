"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  CreditCard,
  Globe,
  GraduationCap,
  IdCard,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Shield,
  Tag,
  UserCog,
  Users,
  Wallet,
  Wallet2,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Menú principal.
 *
 * Agrupado por módulo, no como una lista plana. Antes convivían quince enlaces al mismo
 * nivel: "Config. del módulo" al lado de "Socios" no decía de qué módulo era, y lo último
 * que se agregaba quedaba abajo de todo sin que nadie lo encontrara.
 *
 * Cada grupo aparece solo si el módulo está activo y la persona tiene permiso. Un grupo con
 * un solo elemento no lleva encabezado: sería un título para nada.
 */

type Item = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Cuándo se marca como actual. Por omisión, coincidencia exacta. */
  isActive: (path: string) => boolean;
};

function exact(href: string) {
  return (path: string) => path === href;
}

function under(href: string) {
  return (path: string) => path === href || path.startsWith(`${href}/`);
}

function itemClass(active: boolean) {
  return [
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
    active
      ? "bg-[var(--fo-accent-muted)] font-medium text-[var(--fo-text)]"
      : "text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]",
  ].join(" ");
}

function Section({
  title,
  items,
  path,
}: {
  title: string | null;
  items: Item[];
  path: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {title ? (
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--fo-muted-soft)]">
          {title}
        </p>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={itemClass(item.isActive(path))}>
            <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
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

  // El padrón se marca actual solo en sus propias pantallas: si abarcara todo /members,
  // quedaría iluminado mientras mirás Cuotas y no sabrías dónde estás parado.
  const socios: Item[] = membersEnabled
    ? [
        {
          href: "/members",
          label: "Padrón",
          icon: Users,
          isActive: (p) =>
            p === "/members" ||
            (p.startsWith("/members/") &&
              !p.startsWith("/members/categories") &&
              !p.startsWith("/members/cuotas") &&
              !p.startsWith("/members/carnets") &&
              !p.startsWith("/members/solicitudes") &&
              !p.startsWith("/members/import")),
        },
        ...(canManageMembers
          ? [
              {
                href: "/members/solicitudes",
                label: "Solicitudes",
                icon: Inbox,
                isActive: under("/members/solicitudes"),
              },
              {
                href: "/members/cuotas",
                label: "Cuotas",
                icon: Wallet,
                // La configuración de cuotas tiene su propia entrada más abajo.
                isActive: exact("/members/cuotas"),
              },
              {
                href: "/members/carnets",
                label: "Carnets",
                icon: CreditCard,
                isActive: under("/members/carnets"),
              },
              {
                href: "/members/categories",
                label: "Categorías",
                icon: Tag,
                isActive: under("/members/categories"),
              },
              {
                href: "/members/cuotas/configuracion",
                label: "Valores y calendario",
                icon: CalendarClock,
                isActive: under("/members/cuotas/configuracion"),
              },
            ]
          : []),
      ]
    : [];

  const cursos: Item[] = coursesEnabled
    ? [
        {
          href: "/dashboard/courses",
          label: "Cursos",
          icon: GraduationCap,
          isActive: (p) =>
            p.startsWith("/dashboard/courses") ||
            p === "/courses" ||
            p.startsWith("/courses/new") ||
            /^\/courses\/[^/]+\/edit$/.test(p),
        },
        { href: "/dashboard/sales", label: "Ventas", icon: LayoutGrid, isActive: under("/dashboard/sales") },
        { href: "/courses/teachers", label: "Docentes", icon: Users, isActive: under("/courses/teachers") },
        { href: "/courses/leads", label: "Inscripciones", icon: Inbox, isActive: under("/courses/leads") },
        { href: "/courses/settings", label: "Configuración", icon: Settings, isActive: under("/courses/settings") },
      ]
    : [];

  const institucion: Item[] = canManageWorkspaceSettings
    ? [
        {
          href: "/workspace/configuracion",
          label: "Datos de la institución",
          icon: Settings,
          isActive: exact("/workspace/configuracion"),
        },
        {
          href: "/workspace/configuracion/cobros",
          label: "Cobros",
          icon: Wallet2,
          isActive: under("/workspace/configuracion/cobros"),
        },
      ]
    : [];

  const plataforma: Item[] = platformAdmin
    ? [
        { href: "/admin", label: "Administración", icon: Shield, isActive: exact("/admin") },
        { href: "/admin/workspaces", label: "Workspaces", icon: Building2, isActive: under("/admin/workspaces") },
        { href: "/admin/users", label: "Usuarios", icon: UserCog, isActive: under("/admin/users") },
        { href: "/admin/owners", label: "Dueños", icon: Users, isActive: under("/admin/owners") },
      ]
    : [];

  const otros: Item[] = [
    ...(evaluacionesEnabled
      ? [{ href: "/evaluaciones", label: "Evaluaciones", icon: LayoutGrid, isActive: under("/evaluaciones") }]
      : []),
    ...(websiteEnabled
      ? [{ href: "/website", label: "Sitio web", icon: Globe, isActive: under("/website") }]
      : []),
  ];

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      <Section
        title={null}
        path={path}
        items={[
          { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, isActive: exact("/dashboard") },
        ]}
      />
      <Section title="Socios" items={socios} path={path} />
      <Section title="Cursos" items={cursos} path={path} />
      {/* Evaluaciones y Sitio web son módulos de un solo elemento: un encabezado sobraría. */}
      <Section title={otros.length > 1 ? "Módulos" : null} items={otros} path={path} />
      <Section title="Institución" items={institucion} path={path} />
      <Section title="Plataforma" items={plataforma} path={path} />
    </nav>
  );
}
