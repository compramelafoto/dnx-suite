"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  HeaderAuthActions,
  type SiteHeaderAuth,
} from "@/components/navigation/HeaderAuthActions";
import {
  mobileNavGroups,
  primaryNavLinks,
} from "@/components/navigation/nav-links";

export type NavLink = {
  href: string;
  label: string;
};

type Props = {
  links: NavLink[];
  auth?: SiteHeaderAuth | null;
};

function NavIcon({ label }: { label: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-5 shrink-0 text-[var(--is-muted)]",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
  } as const;

  switch (label) {
    case "Noticias":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 5h12v14H4z" />
          <path d="M8 9h4M8 13h6M16 8h4v11H16" strokeLinecap="round" />
        </svg>
      );
    case "Eventos":
      return (
        <svg {...common} aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="1.5" />
          <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      );
    case "Fotógrafos":
    case "Colaboradores":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="13" r="3.5" />
          <path d="M4 9h3l1.5-2h7L17 9h3v10H4V9z" strokeLinejoin="round" />
        </svg>
      );
    case "Deportes":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4c2 2.5 2 13 0 16M4 12h16M7 7c3 2 7 2 10 0M7 17c3-2 7-2 10 0" />
        </svg>
      );
    case "Cultura":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 18V7l8-3 8 3v11" strokeLinejoin="round" />
          <path d="M12 4v14M8 18h8" strokeLinecap="round" />
        </svg>
      );
    case "Agenda":
      return (
        <svg {...common} aria-hidden>
          <path d="M8 3v3M16 3v3M4 9h16" strokeLinecap="round" />
          <rect x="4" y="5" width="16" height="15" rx="1.5" />
          <path d="M8 13h3M13 13h3M8 16h3" strokeLinecap="round" />
        </svg>
      );
    case "Contacto":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 6h16v12H4z" />
          <path d="M4 7l8 6 8-6" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export function MobileNavigation({ links, auth = null }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const byLabel = useMemo(() => {
    const map = new Map<string, NavLink>();
    for (const link of links) map.set(link.label, link);
    for (const link of primaryNavLinks) {
      if (!map.has(link.label)) map.set(link.label, link);
    }
    return map;
  }, [links]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const today = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const panel =
    open && mounted
      ? createPortal(
          <div
            id={panelId}
            className="fixed inset-0 z-[100] flex flex-col bg-[var(--is-white-0)]"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación"
          >
            <div className="is-site-pad flex items-center justify-between border-b border-[var(--is-border)] py-4">
              <BrandMark href="/" variant="horizontal" />
              <button
                ref={closeRef}
                type="button"
                className="inline-flex size-11 items-center justify-center text-[var(--is-text)]"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="is-site-pad space-y-1 border-b border-[var(--is-border)] bg-[var(--is-bg-secondary)] py-3 text-[12px] text-[var(--is-text-secondary)]">
              <p className="font-medium capitalize text-[var(--is-text)]">
                {today}
              </p>
              <p>Rosario · Santa Fe</p>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto">
              <p className="is-site-pad pt-7 text-[0.95rem] leading-relaxed text-[var(--is-text-secondary)]">
                Descubrí eventos, publicá el tuyo o sumate como fotógrafo.
              </p>

              {mobileNavGroups.map((group) => (
                <section key={group.id} className="mt-6">
                  <p className="is-site-pad is-eyebrow mb-2">{group.title}</p>
                  <nav aria-label={group.title}>
                    {group.items.map((label) => {
                      const link = byLabel.get(label);
                      if (!link) return null;
                      return (
                        <Link
                          key={`${link.href}-${label}`}
                          href={link.href}
                          className="is-site-pad flex min-h-14 items-center gap-4 border-b border-[var(--is-border)] text-[1.125rem] font-semibold tracking-[-0.02em] text-[var(--is-text)]"
                          onClick={() => setOpen(false)}
                        >
                          <NavIcon label={label} />
                          {label}
                        </Link>
                      );
                    })}
                  </nav>
                </section>
              ))}

              <div className="is-site-pad mt-auto space-y-3 py-8">
                <HeaderAuthActions
                  auth={auth}
                  stacked
                  className="mb-2"
                  onNavigate={() => setOpen(false)}
                />
                <Link
                  href="/publicar-evento"
                  className="is-btn is-btn-solid h-11 w-full text-sm font-semibold transition-opacity hover:opacity-90"
                  onClick={() => setOpen(false)}
                >
                  Publicar evento
                </Link>
                <Link
                  href="/quienes-somos"
                  className="inline-flex h-11 w-full items-center justify-center text-sm font-medium text-[var(--is-text-secondary)] ring-1 ring-[var(--is-border)] transition-colors hover:text-[var(--is-text)]"
                  onClick={() => setOpen(false)}
                >
                  Quiero cubrir como fotógrafo
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="xl:hidden">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center text-[var(--is-text)]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "Cerrar" : "Menú"}</span>
        <span aria-hidden className="relative block h-3.5 w-5">
          <span
            className={`absolute left-0 top-0 h-0.5 w-full bg-current transition duration-200 ${open ? "top-1.5 rotate-45" : ""}`}
          />
          <span
            className={`absolute left-0 top-1.5 h-0.5 w-full bg-current transition duration-200 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`absolute left-0 top-3 h-0.5 w-full bg-current transition duration-200 ${open ? "top-1.5 -rotate-45" : ""}`}
          />
        </span>
      </button>
      {panel}
    </div>
  );
}
