"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/concursos", label: "Concursos", icon: IconTrophy },
  { href: "/categorias", label: "Categorías", icon: IconFolder },
  { href: "/participaciones", label: "Participaciones", icon: IconPhoto },
  { href: "/jurados", label: "Jurados", icon: IconUsers },
  { href: "/ranking", label: "Ranking", icon: IconChart },
  { href: "/diplomas", label: "Diplomas", icon: IconDocument },
] as const;

function IconDashboard() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
function IconPhoto() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconDocument() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function IconX() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function IconHamburger() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  expanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ open, onClose, expanded, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`
          z-30 ml-4 flex shrink-0 flex-col rounded-lg bg-[#000000] text-fr-primary font-sans
          transition-[width] duration-200 ease-in-out
          hidden border border-fr-border
          lg:flex lg:min-h-0 lg:ml-6
          ${expanded ? "lg:w-64" : "lg:w-20"}
        `}
      >
        <div className="h-36 shrink-0 w-full rounded-t-lg bg-[#050505] md:h-44 lg:h-48" aria-hidden />
        <div className={`flex border-b border-fr-border px-5 py-3 ${expanded ? "justify-end" : "justify-center"}`}>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full p-2 text-fr-muted transition-colors hover:bg-fr-card hover:text-fr-primary"
            aria-label={expanded ? "Minimizar menú" : "Abrir menú"}
          >
            {expanded ? <IconX /> : <IconHamburger />}
          </button>
        </div>
        <nav className="fr-sidebar-nav flex flex-1 flex-col gap-0.5 overflow-y-auto py-5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={!expanded ? item.label : undefined}
                className={`flex items-center gap-4 rounded-lg py-3.5 text-sm font-medium transition-colors ${
                  expanded ? "fr-sidebar-link pl-8 pr-4" : "justify-center px-4"
                } ${
                  isActive
                    ? "bg-fr-card text-gold"
                    : "text-fr-muted hover:bg-fr-card/60 hover:text-fr-primary"
                }`}
              >
                <Icon />
                {expanded && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
