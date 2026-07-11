"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteContainer } from "@/components/foundations";
import { cx } from "@/components/foundations/cx";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  MobileNavigation,
  type NavLink,
} from "@/components/navigation/MobileNavigation";
import { primaryNavLinks } from "@/components/navigation/nav-links";

export { primaryNavLinks };

type Props = {
  links?: NavLink[];
};

function MastheadBar() {
  const now = new Date();
  const today = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const updated = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return (
    <div className="border-b border-[var(--is-border)] bg-[var(--is-bg-secondary)]">
      <SiteContainer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1 py-2 text-[11px] leading-none tracking-[0.03em] text-[var(--is-text-secondary)] sm:text-[12px]">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 capitalize">
          <span className="font-medium text-[var(--is-text)]">{today}</span>
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 sm:gap-x-5">
          <span>
            <span className="font-medium text-[var(--is-text)]">Rosario</span>
            <span aria-hidden> · </span>
            Santa Fe
          </span>
          <span className="hidden text-[var(--is-muted)] md:inline">
            Última actualización {updated}
          </span>
        </p>
      </SiteContainer>
    </div>
  );
}

function SearchField({ className }: { className?: string }) {
  return (
    <label className={className}>
      <span className="sr-only">Buscar (próximamente)</span>
      <span className="flex h-10 w-full items-center gap-3 rounded-full bg-[var(--is-white-100)] px-5 ring-1 ring-[var(--is-border)] transition-[box-shadow,background-color] duration-200 focus-within:bg-[var(--is-white-0)] focus-within:ring-[var(--is-graphite-300)]">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-[15px] shrink-0 text-[var(--is-muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Buscar noticias, eventos, fotógrafos…"
          disabled
          className="h-full w-full min-w-0 bg-transparent text-[0.9375rem] tracking-[-0.01em] text-[var(--is-text)] placeholder:text-[var(--is-muted)] focus:outline-none disabled:cursor-not-allowed"
          title="Buscador próximamente"
        />
      </span>
    </label>
  );
}

/**
 * Header editorial de medio nacional.
 * Masthead + marca protagonista + nav + búsqueda + CTA contenido.
 */
export function SiteHeader({ links = primaryNavLinks }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const mobileLinks: NavLink[] = [{ href: "/", label: "Inicio" }, ...links];

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "sticky top-0 z-40 transition-[background-color,box-shadow] duration-300 ease-out",
        scrolled
          ? "bg-[color-mix(in_oklab,var(--is-white-0)_92%,transparent)] shadow-[0_1px_0_0_var(--is-border)] backdrop-blur-lg"
          : "bg-[color-mix(in_oklab,var(--is-white-0)_96%,transparent)] backdrop-blur-md",
      )}
    >
      <div
        className={cx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          scrolled
            ? "grid-rows-[0fr] opacity-0"
            : "grid-rows-[1fr] opacity-100",
        )}
        aria-hidden={scrolled}
      >
        <div className="overflow-hidden">
          <MastheadBar />
        </div>
      </div>

      <div className="border-b border-[var(--is-border)]">
        <SiteContainer>
          <div
            className={cx(
              "flex items-center justify-between gap-5 transition-[padding] duration-300 ease-out md:gap-8",
              scrolled ? "py-2.5 md:py-3" : "py-4 md:py-5",
            )}
          >
            <BrandMark variant="horizontal" priority />

            <div className="flex min-w-0 flex-1 items-center justify-end gap-3 md:gap-4 lg:gap-6">
              <SearchField className="hidden min-w-0 flex-1 md:block lg:max-w-md xl:max-w-xl" />

              <Link
                href="/publicar-evento"
                className="hidden h-8 shrink-0 items-center px-3 text-[13px] font-medium tracking-[-0.01em] text-[var(--is-text-secondary)] ring-1 ring-[var(--is-border)] transition-colors duration-200 hover:text-[var(--is-text)] hover:ring-[var(--is-graphite-400)] sm:inline-flex"
              >
                Publicar evento
              </Link>

              <MobileNavigation links={mobileLinks} />
            </div>
          </div>

          <nav
            aria-label="Principal"
            className={cx(
              "hidden items-center border-t border-[var(--is-border)] transition-[padding,gap] duration-300 ease-out xl:flex",
              scrolled
                ? "gap-7 py-2.5"
                : "gap-8 py-3.5",
            )}
          >
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="relative py-0.5 text-[0.9375rem] font-medium tracking-[-0.015em] text-[var(--is-text-secondary)] transition-colors duration-200 hover:text-[var(--is-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </SiteContainer>
      </div>
    </header>
  );
}
