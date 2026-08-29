"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  Palette,
  Globe,
  GraduationCap,
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
import { useShellNav } from "./shell-frame";
import {
  claimedPrefixes,
  submodulesFor,
  type SubmoduleItem,
} from "@/lib/modules/submodules";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";

/**
 * Menú principal.
 *
 * Agrupado por módulo, no como una lista plana. Antes convivían quince enlaces al mismo
 * nivel: "Config. del módulo" al lado de "Socios" no decía de qué módulo era, y lo último
 * que se agregaba quedaba abajo de todo sin que nadie lo encontrara.
 *
 * Cada grupo aparece solo si el módulo está activo y la persona tiene permiso.
 *
 * Toda sección con nombre lleva su encabezado, incluso con un solo elemento. La regla
 * anterior —"un grupo de uno no lleva título"— producía el defecto contrario: "Sitio web"
 * quedaba suelto debajo de "Valores y calendario" y se leía como parte de Socios. Un ítem
 * sin encabezado se lee siempre como parte de la sección de arriba.
 *
 * El orden de las secciones y de sus ítems está fijado en
 * `docs/fotoffice/ARQUITECTURA-NAVEGACION.md`, junto con el lugar reservado para los módulos
 * que todavía no existen. Un módulo planificado NO se agrega acá hasta tener pantalla real:
 * el menú no promete.
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

/** Los íconos que puede nombrar un submódulo. Cerrado a propósito: un nombre suelto no dibuja nada. */
const ICONOS: Record<string, ComponentType<{ className?: string }>> = {
  CalendarClock,
  CreditCard,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Palette,
  Tag,
  Users,
  Wallet,
};

/**
 * Convierte las pantallas declaradas de un módulo en entradas del menú.
 *
 * La lista vive en `lib/modules/submodules.ts` y la comparte con el inicio del workspace: es
 * lo que evita que una pantalla nueva aparezca en un lado y en el otro no.
 */
function itemsDeModulo(moduleKey: string, canManage: boolean): Item[] {
  const reclamadas = claimedPrefixes(moduleKey);
  return submodulesFor(moduleKey, { canManage }).map((sub: SubmoduleItem) => ({
    href: sub.href,
    label: sub.label,
    icon: ICONOS[sub.icon] ?? LayoutDashboard,
    isActive:
      sub.activeMatch === "exact"
        ? exact(sub.href)
        : sub.activeMatch === "under"
          ? under(sub.href)
          : // "rest": el resto del módulo, lo que no reclama ninguna otra entrada. Si abarcara
            // todo, quedaría iluminado mientras mirás Cuotas y no sabrías dónde estás parado.
            (path: string) =>
              path === sub.href ||
              (path.startsWith(`${sub.href}/`) &&
                !reclamadas.some((r) => path === r || path.startsWith(`${r}/`))),
  }));
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
  onNavigate,
}: {
  title: string | null;
  items: Item[];
  path: string;
  /** En el teléfono el menú tapa el contenido: elegir una opción tiene que cerrarlo. */
  onNavigate: () => void;
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
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={itemClass(item.isActive(path))}
          >
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
  const { closeDrawer } = useShellNav();

  const socios: Item[] = membersEnabled
    ? itemsDeModulo(MEMBERS_MODULE_KEY, canManageMembers)
    : [];

  const cursos: Item[] = coursesEnabled
    ? itemsDeModulo(COURSES_SALES_MODULE_KEY, true)
    : [];

  // Evaluaciones evalúa actividades de los cursos: es del mismo dominio, no un módulo suelto.
  // Tiene su propia llave, así que puede estar encendido sin cursos — en ese caso la sección
  // "Cursos" muestra solo este ítem, que sigue siendo cierto.
  const cursosItems: Item[] = [
    ...cursos,
    ...(evaluacionesEnabled
      ? [
          {
            href: "/evaluaciones",
            label: "Evaluaciones",
            icon: ClipboardCheck,
            isActive: under("/evaluaciones"),
          },
        ]
      : []),
    ...(coursesEnabled
      ? [
          {
            href: "/courses/settings",
            label: "Configuración",
            icon: Settings,
            isActive: under("/courses/settings"),
          },
        ]
      : []),
  ];

  // Formularios compartibles para juntar contactos. Vivían escritos aparte, debajo del menú y
  // con otro estilo: se veían como un apéndice y no como un módulo más.
  // Deuda registrada: no tiene llave de módulo, así que no se puede apagar por organización.
  const captacion: Item[] = [
    {
      href: "/dashboard/service-leads/forms",
      label: "Formularios",
      icon: FileText,
      isActive: under("/dashboard/service-leads/forms"),
    },
    {
      href: "/dashboard/service-leads",
      label: "Leads",
      icon: Inbox,
      isActive: exact("/dashboard/service-leads"),
    },
  ];

  // Presencia pública: hoy un solo ítem, y aun así con encabezado propio. Es donde aterrizan
  // el blog, los portfolios y las redes cuando existan.
  const presencia: Item[] = websiteEnabled
    ? [{ href: "/website", label: "Sitio web", icon: Globe, isActive: under("/website") }]
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

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      <Section
        title={null}
        path={path}
        onNavigate={closeDrawer}
        items={[
          { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, isActive: exact("/dashboard") },
        ]}
      />
      <Section title="Socios" items={socios} path={path} onNavigate={closeDrawer} />
      <Section title="Cursos" items={cursosItems} path={path} onNavigate={closeDrawer} />
      <Section title="Captación" items={captacion} path={path} onNavigate={closeDrawer} />
      <Section title="Presencia pública" items={presencia} path={path} onNavigate={closeDrawer} />
      <Section title="Institución" items={institucion} path={path} onNavigate={closeDrawer} />
      <Section title="Plataforma" items={plataforma} path={path} onNavigate={closeDrawer} />
    </nav>
  );
}
