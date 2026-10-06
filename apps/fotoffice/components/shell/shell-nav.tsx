"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { serializeOpenGroupsCookie, toggleGroup, visibleOpenGroups } from "@/lib/shell/nav-groups";
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Globe,
  Link2,
  Plug,
  Inbox,
  LayoutDashboard,
  Newspaper,
  Settings,
  Shield,
  UserCog,
  Users,
  Wallet2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useShellNav } from "./shell-frame";
import { MenuSearch, type MenuSearchSection } from "./menu-search";
import { ICONOS } from "./nav-icons";
import {
  claimedPrefixes,
  submodulesFor,
  type SubmoduleAccess,
  type SubmoduleItem,
} from "@/lib/modules/submodules";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { SPONSORS_MODULE_KEY } from "@/lib/sponsors/constants";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { hasLevel, type ModuleLevels } from "@/lib/permissions/levels";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { isBlogNavActive, isDomainNavActive, isWebsiteNavActive } from "@/lib/blog/admin-nav";

/**
 * Menú principal.
 *
 * Agrupado por módulo, no como una lista plana. Antes convivían quince enlaces al mismo
 * nivel: "Config. del módulo" al lado de "Socios" no decía de qué módulo era, y lo último
 * que se agregaba quedaba abajo de todo sin que nadie lo encontrara.
 *
 * Cada grupo aparece sólo si la persona tiene al menos `VIEW` en su módulo (un módulo apagado
 * ya viene en NONE), y sus pantallas de gestión sólo con `MANAGE` o con la acción sensible que
 * exija la página. Es la misma regla que aplican las páginas: el menú no ofrece lo que niegan.
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
  /** Qué se hace ahí, en una línea. No se dibuja en el menú: el buscador busca dentro. */
  description?: string;
};

function exact(href: string) {
  return (path: string) => path === href;
}

function under(href: string) {
  return (path: string) => path === href || path.startsWith(`${href}/`);
}

/**
 * Convierte las pantallas declaradas de un módulo en entradas del menú.
 *
 * La lista vive en `lib/modules/submodules.ts` y la comparte con el inicio del workspace: es
 * lo que evita que una pantalla nueva aparezca en un lado y en el otro no.
 */
function itemsDeModulo(
  moduleKey: string,
  access: SubmoduleAccess,
  vocabulary: PersonVocabulary,
): Item[] {
  const reclamadas = claimedPrefixes(moduleKey);
  return submodulesFor(moduleKey, access, vocabulary).map((sub: SubmoduleItem) => ({
    href: sub.href,
    label: sub.label,
    description: sub.description,
    icon: ICONOS[sub.icon] ?? LayoutDashboard,
    isActive:
      sub.activeMatch === "exact"
        ? exact(sub.href)
        : sub.activeMatch === "under"
          ? // Si otra entrada cuelga de ésta (Pedidos online y su Configuración), la hija gana.
            (path: string) =>
              under(sub.href)(path) &&
              !reclamadas.some((r) => r.startsWith(`${sub.href}/`) && under(r)(path))
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
  open,
  onToggle,
}: {
  title: string | null;
  items: Item[];
  path: string;
  /** En el teléfono el menú tapa el contenido: elegir una opción tiene que cerrarlo. */
  onNavigate: () => void;
  /** Desplegado. El grupo sin título (Inicio) se ve siempre. */
  open: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;
  const visible = title === null || open;
  const id = title ? `menu-grupo-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined;
  const tieneActivo = items.some((i) => i.isActive(path));
  return (
    <div className="flex flex-col gap-0.5">
      {title ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="group mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--fo-muted-soft)] transition-colors hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fo-accent)]"
        >
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {!open ? (
            <span className="flex items-center gap-1.5 normal-case tracking-normal">
              {tieneActivo ? <span className="size-1.5 rounded-full bg-[var(--fo-accent)]" aria-hidden /> : null}
              <span className="text-[10px] font-medium tabular-nums">{items.length}</span>
            </span>
          ) : null}
          <ChevronDown
            className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        </button>
      ) : null}
      {visible ? (
        <div id={id} className="flex flex-col gap-0.5">
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
      ) : null}
    </div>
  );
}

export function ShellNav({
  levels,
  actions,
  canManageWorkspaceSettings,
  platformAdmin,
  vocabulary,
  openGroups = [],
}: {
  /** Nivel en cada módulo, de `getModuleLevels`. Un módulo apagado viene en NONE. */
  levels: ModuleLevels;
  /** Acciones sensibles vigentes, resueltas en el servidor con `hasModuleAction`. */
  actions: readonly string[];
  /** Sólo para la sección Institución: Configuración no se delega. */
  canManageWorkspaceSettings: boolean;
  platformAdmin: boolean;
  vocabulary: PersonVocabulary;
  /** Grupos que la persona dejó desplegados, leídos de la cookie en el servidor. */
  openGroups?: readonly string[];
}) {
  const path = usePathname() ?? "";
  const { closeDrawer } = useShellNav();
  const [guardados, setGuardados] = useState<string[]>(() => [...openGroups]);
  // Cerrar el grupo de la pantalla actual vale hasta cambiar de pantalla: al llegar a otra,
  // su grupo se abre solo.
  const [cerradoAqui, setCerradoAqui] = useState<{ path: string; title: string } | null>(null);
  // Mismos roles que `isFullAccessRole` (dueño o admin): decide las pantallas de plata, como Cobros.
  const access: SubmoduleAccess = { levels, actions, fullAccess: canManageWorkspaceSettings };
  const ve = (moduleKey: string) => hasLevel(levels[moduleKey] ?? "NONE", "VIEW");
  const gestiona = (moduleKey: string) => hasLevel(levels[moduleKey] ?? "NONE", "MANAGE");

  // `itemsDeModulo` ya devuelve vacío sin VIEW en el módulo: la sección no se dibuja.
  const socios: Item[] = itemsDeModulo(MEMBERS_MODULE_KEY, access, vocabulary);

  const reservas: Item[] = itemsDeModulo(BOOKINGS_MODULE_KEY, access, vocabulary);

  // Sorteos vive en el grupo Socios: es una de las cosas que la institución le da al socio
  // al día, y separarlo en su propia sección lo dejaría suelto al lado de Cuotas.
  const sorteos: Item[] = itemsDeModulo(RAFFLES_MODULE_KEY, access, vocabulary);

  // Sponsors al lado de Sorteos: muchas de esas marcas son las mismas que donan los premios.
  const sponsors: Item[] = itemsDeModulo(SPONSORS_MODULE_KEY, access, vocabulary);

  // Comisión: los proyectos de la comisión directiva y sus tareas. Grupo propio: lo usa la
  // comisión, que no necesariamente gestiona el padrón.
  const comision: Item[] = itemsDeModulo(GOVERNANCE_MODULE_KEY, access, vocabulary);

  // Comunicación: las placas para redes. Grupo propio porque lo usa un área —quien lleva las
  // redes de la institución—, que puede no tener nada que ver con el padrón.
  const comunicacion: Item[] = itemsDeModulo(COMMUNICATIONS_MODULE_KEY, access, vocabulary);

  // Grupo propio y no dentro de Socios: coberturas se le pide a cualquier institución con
  // actividad fotográfica, no sólo a las que tienen padrón de socios. Colaboradores y
  // Configuración exigen además coordinar (`coverages.coordinate`).
  const coberturas: Item[] = itemsDeModulo(COVERAGES_MODULE_KEY, access, vocabulary);

  const cursos: Item[] = itemsDeModulo(COURSES_SALES_MODULE_KEY, access, vocabulary);

  // Evaluaciones evalúa actividades de los cursos: es del mismo dominio, no un módulo suelto.
  // Tiene su propia llave, así que puede estar encendido sin cursos — en ese caso la sección
  // "Cursos" muestra solo este ítem, que sigue siendo cierto.
  const cursosItems: Item[] = [
    ...cursos,
    ...(ve(EVALUACIONES_MODULE_KEY)
      ? [
          {
            href: "/evaluaciones",
            label: "Evaluaciones",
            description: "Las evaluaciones de las actividades de cada curso.",
            icon: ClipboardCheck,
            isActive: under("/evaluaciones"),
          },
        ]
      : []),
    // La configuración del módulo (moneda, texto de inscripción, comisión) la guarda sólo
    // dueño/admin (`app/actions/settings.ts`): ofrecerla a un rol que no puede guardarla sería
    // prometer algo que la pantalla niega.
    ...(ve(COURSES_SALES_MODULE_KEY) && canManageWorkspaceSettings
      ? [
          {
            href: "/courses/settings",
            label: "Configuración",
            description: "Moneda, texto de inscripción y comisión del módulo de cursos.",
            icon: Settings,
            isActive: under("/courses/settings"),
          },
        ]
      : []),
  ];

  /*
    Formularios públicos para pedir presupuesto y la bandeja donde llegan esas consultas.

    Estaban escritos a mano acá, sin llave de módulo, así que **le aparecían a todo el
    mundo** usara o no la función —la deuda estaba anotada en este mismo lugar desde que se
    agregaron—. Ahora es un módulo como los demás y arranca apagado.
  */
  const captacion: Item[] = ve(SERVICE_LEADS_MODULE_KEY)
    ? [
        {
          href: "/dashboard/service-leads/forms",
          label: "Formularios",
          description: "Los formularios públicos para pedir presupuesto.",
          icon: FileText,
          isActive: under("/dashboard/service-leads/forms"),
        },
        {
          href: "/dashboard/service-leads",
          label: "Leads",
          description: "Las consultas y pedidos de presupuesto que llegaron.",
          icon: Inbox,
          isActive: exact("/dashboard/service-leads"),
        },
      ]
    : [];

  // Presencia pública: el sitio y su blog. Es donde aterrizan los portfolios y las redes
  // cuando existan.
  //
  // El blog vive adentro de `/website` (es una sección del módulo Sitio web, con la misma
  // llave), pero tiene ítem propio porque se usa todas las semanas y el constructor no.
  // Por eso "Sitio web" deja de marcarse con `under("/website")`: adentro del blog quedaban
  // los dos encendidos. Sólo lo ven quienes pueden escribir en él (`website` MANAGE).
  const presencia: Item[] = ve(WEBSITE_MODULE_KEY)
    ? [
        { href: "/website", label: "Sitio web", description: "El sitio público de la institución: páginas, diseño y menú.", icon: Globe, isActive: isWebsiteNavActive },
        ...(gestiona(WEBSITE_MODULE_KEY)
          ? [{ href: "/website/blog", label: "Blog", description: "Los artículos y novedades del sitio.", icon: Newspaper, isActive: isBlogNavActive }]
          : []),
        // Conectar el dominio propio (ej. sfpr.com.ar) es un dato de la institución: dueño o admin.
        ...(canManageWorkspaceSettings
          ? [{ href: "/website/dominio", label: "Dominio", description: "Conectar el dominio propio del sitio.", icon: Link2, isActive: isDomainNavActive }]
          : []),
      ]
    : [];

  const institucion: Item[] = canManageWorkspaceSettings
    ? [
        {
          href: "/workspace/configuracion",
          label: "Datos de la institución",
          description: "Nombre, logo, domicilio y datos de contacto de la institución.",
          icon: Settings,
          isActive: exact("/workspace/configuracion"),
        },
        {
          href: "/workspace/configuracion/comision",
          label: "Comisión directiva",
          description: "Quién integra la comisión, con qué cargo y qué puede hacer cada uno.",
          icon: Users,
          isActive: under("/workspace/configuracion/comision"),
        },
        {
          href: "/workspace/configuracion/integraciones",
          label: "Integraciones",
          description: "Conexiones con Google, WhatsApp y otros servicios.",
          icon: Plug,
          isActive: under("/workspace/configuracion/integraciones"),
        },
        {
          href: "/workspace/configuracion/cobros",
          label: "Cobros",
          description: "Cómo cobra la institución y en qué cuenta entra la plata.",
          icon: Wallet2,
          isActive: under("/workspace/configuracion/cobros"),
        },
      ]
    : [];

  const plataforma: Item[] = platformAdmin
    ? [
        { href: "/admin", label: "Administración", description: "El panel de la plataforma.", icon: Shield, isActive: exact("/admin") },
        { href: "/admin/workspaces", label: "Workspaces", description: "Todas las instituciones de la plataforma.", icon: Building2, isActive: under("/admin/workspaces") },
        { href: "/admin/users", label: "Usuarios", description: "Todas las cuentas de la plataforma.", icon: UserCog, isActive: under("/admin/users") },
        { href: "/admin/owners", label: "Dueños", description: "Quién es dueño de cada institución.", icon: Users, isActive: under("/admin/owners") },
      ]
    : [];

  // Una sola lista para el menú y para el buscador: el buscador no puede ofrecer una pantalla
  // que el menú no dibuja, y una pantalla nueva aparece en los dos lados sin acordarse.
  const secciones: { title: string | null; items: Item[] }[] = [
    {
      title: null,
      items: [
        // El tablero de la institución. `/dashboard` queda como pantalla de rescate para quien
        // no tiene permiso en algún módulo, y se marca igual: también es "el inicio".
        {
          href: "/workspace",
          label: "Inicio",
          description: "El tablero de la institución: lo pendiente y lo último que pasó.",
          icon: LayoutDashboard,
          isActive: (p: string) => p === "/workspace" || p === "/dashboard",
        },
      ],
    },
    { title: vocabulary.Plural, items: socios },
    { title: "Sorteos", items: sorteos },
    { title: "Sponsors", items: sponsors },
    { title: "Comisión", items: comision },
    { title: "Comunicación", items: comunicacion },
    { title: "Coberturas", items: coberturas },
    { title: "Cursos", items: cursosItems },
    { title: "Reservas", items: reservas },
    { title: "Captación", items: captacion },
    { title: "Presencia pública", items: presencia },
    { title: "Institución", items: institucion },
    { title: "Plataforma", items: plataforma },
  ];

  const buscables: MenuSearchSection[] = secciones.map((sec) => ({
    title: sec.title ?? "Inicio",
    items: sec.items.map(({ href, label, description, icon: Icon }) => ({
      href,
      label,
      description,
      icon: <Icon className="size-4" aria-hidden />,
    })),
  }));

  const grupoActivo = secciones.find((sec) => sec.title && sec.items.some((i) => i.isActive(path)))?.title ?? null;
  const abiertos = visibleOpenGroups(guardados, grupoActivo);
  if (cerradoAqui && cerradoAqui.path === path) abiertos.delete(cerradoAqui.title);

  function alternar(title: string) {
    const abierto = abiertos.has(title);
    const siguiente = abierto ? guardados.filter((t) => t !== title) : toggleGroup(guardados.filter((t) => t !== title), title);
    setGuardados(siguiente);
    setCerradoAqui(abierto && title === grupoActivo ? { path, title } : null);
    try {
      document.cookie = serializeOpenGroupsCookie(siguiente);
    } catch {
      // Sin cookies el menú igual se pliega; sólo no lo recuerda.
    }
  }

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      <MenuSearch sections={buscables} onNavigate={closeDrawer} />
      {secciones.map((sec) => (
        <Section
          key={sec.title ?? "inicio"}
          title={sec.title}
          items={sec.items}
          path={path}
          onNavigate={closeDrawer}
          open={sec.title ? abiertos.has(sec.title) : true}
          onToggle={() => sec.title && alternar(sec.title)}
        />
      ))}
    </nav>
  );
}
