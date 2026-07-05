"use client";

import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type SidebarItem = {
  id: string;
  label: string;
  path?: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string;
  /** Separador visual antes del ítem (grupo secundario). */
  dividerBefore?: boolean;
  children?: {
    id: string;
    label: string;
    path?: string;
    href?: string;
    tab?: string;
    view?: string;
    excludeView?: string;
    badge?: string;
  }[];
};

type Props = {
  items: SidebarItem[];
  logo: React.ReactNode;
  title: string;
  badge?: string;
  activeClass?: string;
  inactiveClass?: string;
  /** Si false, no se muestra el bloque logo/título (para cuando se usa segunda barra full-width) */
  showHeader?: boolean;
  /** Contador dinámico por item id (ej. { soporte: 3 } para mostrar badge con número) */
  dynamicBadgeCounts?: Record<string, number>;
};

const defaultActiveClass = "bg-[#c27b3d]/12 text-[#c27b3d] font-medium border-l-[3px] border-[#c27b3d]";
const defaultInactiveClass = "text-gray-700 hover:bg-gray-50";

function useIsMobileNav() {
  const [isMobileNav, setIsMobileNav] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobileNav(mq.matches);
    const fn = () => setIsMobileNav(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return isMobileNav;
}

export default function SidebarNav({
  items,
  logo,
  title,
  badge,
  activeClass = defaultActiveClass,
  inactiveClass = defaultInactiveClass,
  showHeader = true,
  dynamicBadgeCounts = {},
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobileNav = useIsMobileNav();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  type SidebarChild = NonNullable<SidebarItem["children"]>[number];

  function hrefFor(item: SidebarItem, child?: SidebarChild) {
    if (child) {
      const base = child.path || child.href || item.path || item.href || "#";
      if (base.includes("?")) return base;
      const params = new URLSearchParams();
      if (child.tab) params.set("tab", child.tab);
      if (child.view) params.set("view", child.view);
      const q = params.toString();
      return q ? `${base}?${q}` : base;
    }
    return item.path || item.href || "#";
  }

  function isActive(item: SidebarItem, child?: SidebarChild) {
    const h = hrefFor(item, child);
    if (!h || h === "#") return false;
    const [path, query] = h.split("?");
    const currentPath = pathname || "";
    const matchPath = currentPath === path || (path !== "/" && currentPath.startsWith(path + "/"));
    if (!matchPath) return false;

    if (child?.view) {
      return (searchParams?.get("view") || "") === child.view;
    }
    if (child?.excludeView) {
      return (searchParams?.get("view") || "") !== child.excludeView;
    }

    if (query) {
      const expected = new URLSearchParams(query);
      for (const [key, value] of expected.entries()) {
        if ((searchParams?.get(key) || "") !== value) return false;
      }
      return true;
    }
    if (child?.tab) {
      return (searchParams?.get("tab") || "") === child.tab;
    }
    return true;
  }

  function isGroupActive(item: SidebarItem) {
    if (item.path || item.href) {
      const h = item.path || item.href || "";
      const [path] = h.split("?");
      const currentPath = pathname || "";
      if (path && (currentPath === path || currentPath.startsWith(path + "/"))) return true;
    }
    return item.children?.some((c) => isActive(item, c)) ?? false;
  }

  useEffect(() => {
    const withChildren = items.filter((item) => item.children?.length);
    if (isMobileNav) {
      setExpandedIds(new Set(withChildren.map((item) => item.id)));
      return;
    }
    const next = new Set<string>();
    withChildren.forEach((item) => {
      if (isGroupActive(item)) next.add(item.id);
    });
    setExpandedIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isGroupActive depends on route
  }, [pathname, searchParams, items, isMobileNav]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
      {showHeader && (
        <div className="shrink-0 border-b border-gray-100 p-4 pb-4">
          {logo}
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 break-words font-semibold leading-snug text-gray-900">{title}</span>
            {badge && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{badge}</span>
            )}
          </div>
        </div>
      )}
      <nav
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3",
          "[-webkit-overflow-scrolling:touch]",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          showHeader ? "pt-2" : "pt-2"
        )}
        aria-label="Menú principal"
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = expandedIds.has(item.id);
            const groupActive = isGroupActive(item);

            const divider = item.dividerBefore ? (
              <li key={`${item.id}-divider`} className="pt-3 pb-1" aria-hidden>
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  Más
                </p>
              </li>
            ) : null;

            if (hasChildren) {
              const groupHref = item.path || item.href || "#";
              return (
                <Fragment key={item.id}>
                  {divider}
                  <li>
                  <div
                    className={cn(
                      "flex min-h-[44px] min-w-0 touch-manipulation items-stretch gap-0 rounded-lg px-3 py-2.5 text-sm transition-colors md:min-h-0 md:py-2.5",
                      groupActive ? "bg-[#c27b3d]/10 text-[#c27b3d]" : inactiveClass
                    )}
                  >
                    <Link
                      href={groupHref}
                      onClick={() => {
                        if (isMobileNav && !isOpen) setExpandedIds((prev) => new Set(prev).add(item.id));
                      }}
                      className={cn(
                        "-my-0.5 flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 md:min-h-0",
                        groupActive ? "text-[#c27b3d]" : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                      )}
                    >
                      {item.icon && (
                        <span className="flex w-5 shrink-0 items-center justify-center">{item.icon}</span>
                      )}
                      <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
                        {item.label}
                      </span>
                      {(dynamicBadgeCounts[item.id] ?? 0) > 0 && (
                        <span
                          className="inline-flex h-3.5 min-w-[0.875rem] shrink-0 items-center justify-center rounded-full bg-[#b91c1c] px-1 text-[9px] font-bold leading-none text-white tabular-nums shadow-sm md:h-4 md:min-w-[1rem] md:text-[10px]"
                          aria-label={`${dynamicBadgeCounts[item.id]} notificaciones sin leer`}
                        >
                          {dynamicBadgeCounts[item.id]! > 99 ? "99+" : dynamicBadgeCounts[item.id]}
                        </span>
                      )}
                      {!dynamicBadgeCounts[item.id] && item.badge && (
                        <span className="shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggle(item.id);
                      }}
                      className="flex shrink-0 touch-manipulation items-center justify-center rounded p-2 hover:bg-black/5 active:bg-black/10"
                      aria-label={isOpen ? `Ocultar ${item.label}` : `Mostrar ${item.label}`}
                      aria-expanded={isOpen}
                    >
                      <svg
                        className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2.5">
                      {item.children!.map((sub) => {
                        const subHref = hrefFor(item, sub);
                        const subActive = isActive(item, sub);
                        return (
                          <li key={sub.id}>
                            <Link
                              href={subHref}
                              className={cn(
                                "flex min-h-[40px] min-w-0 touch-manipulation items-center gap-2 rounded-lg py-2 pl-3 pr-2.5 text-[13px] leading-snug transition-colors active:bg-gray-100 md:min-h-0",
                                subActive ? activeClass : inactiveClass
                              )}
                            >
                              <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
                                {sub.label}
                              </span>
                              {"badge" in sub && sub.badge && (
                                <span className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  {sub.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
                </Fragment>
              );
            }

            const linkHref = hrefFor(item);
            const singleActive = isActive(item);
            const linkCount = dynamicBadgeCounts[item.id] ?? 0;
            return (
              <Fragment key={item.id}>
                {divider}
                <li>
                <Link
                  href={linkHref}
                  className={cn(
                    "flex min-h-[44px] min-w-0 touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors active:bg-gray-100 md:min-h-0",
                    singleActive ? activeClass : inactiveClass
                  )}
                >
                  {item.icon && (
                    <span className="flex w-5 shrink-0 items-center justify-center">{item.icon}</span>
                  )}
                  <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
                    {item.label}
                  </span>
                  {linkCount > 0 && (
                    <span
                      className="inline-flex h-3.5 min-w-[0.875rem] shrink-0 items-center justify-center rounded-full bg-[#b91c1c] px-1 text-[9px] font-bold leading-none text-white tabular-nums shadow-sm md:h-4 md:min-w-[1rem] md:text-[10px]"
                      aria-label={`${linkCount} notificaciones sin leer`}
                    >
                      {linkCount > 99 ? "99+" : linkCount}
                    </span>
                  )}
                  {!linkCount && item.badge && (
                    <span className="shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
