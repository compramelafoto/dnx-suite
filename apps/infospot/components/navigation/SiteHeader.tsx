"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteContainer } from "@/components/foundations";
import { cx } from "@/components/foundations/cx";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  HeaderAuthActions,
  type SiteHeaderAuth,
} from "@/components/navigation/HeaderAuthActions";
import {
  MobileNavigation,
  type NavLink,
} from "@/components/navigation/MobileNavigation";
import { primaryNavLinks } from "@/components/navigation/nav-links";
import type { HomeHeaderLink } from "@/lib/home-experience";

export { primaryNavLinks };

type Props = {
  links?: NavLink[];
  /** Sesión DNX resuelta en el layout (null = visitante). */
  auth?: SiteHeaderAuth | null;
  /** CTA principal según experiencia de Home. */
  primaryCta?: HomeHeaderLink | null;
  /** Accesos secundarios del perfil activo (sin acciones editoriales). */
  secondaryLinks?: HomeHeaderLink[];
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
          readOnly
          suppressHydrationWarning
          style={{ caretColor: "transparent" }}
          className="h-full w-full min-w-0 bg-transparent text-[0.9375rem] tracking-[-0.01em] text-[var(--is-text)] placeholder:text-[var(--is-muted)] focus:outline-none disabled:cursor-not-allowed"
          title="Buscador próximamente"
        />
      </span>
    </label>
  );
}

/**
 * Header editorial de medio nacional.
 * Masthead scrollea fuera del flujo; la barra sticky mantiene altura fija
 * (evitar colapsar padding/filas con JS: causa jitter al pelear con sticky).
 */
export function SiteHeader({
  links = primaryNavLinks,
  auth = null,
  primaryCta = null,
  secondaryLinks = [],
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const mobileLinks: NavLink[] = links.some((l) => l.href === "/")
    ? links
    : [{ href: "/", label: "Inicio" }, ...links];

  useEffect(() => {
    // Solo cambia fondo/sombra — nunca la altura. Histeresis evita parpadeo.
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => {
        if (!prev && y > 24) return true;
        if (prev && y < 8) return false;
        return prev;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cta = primaryCta ?? { href: "/publicar-evento", label: "Publicar evento" };

  return (
    <>
      <MastheadBar />

      <header
        className={cx(
          "sticky top-0 z-40 border-b border-[var(--is-border)] transition-[background-color,box-shadow] duration-200 ease-out",
          scrolled
            ? "bg-[color-mix(in_oklab,var(--is-white-0)_92%,transparent)] shadow-[0_1px_0_0_var(--is-border)] backdrop-blur-lg"
            : "bg-[color-mix(in_oklab,var(--is-white-0)_96%,transparent)] backdrop-blur-md",
        )}
      >
        <SiteContainer>
          <div className="flex items-center justify-between gap-5 py-4 md:gap-8 md:py-5">
            <BrandMark variant="horizontal" priority />

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 md:gap-3 lg:gap-5">
              <SearchField className="hidden min-w-0 flex-1 md:block lg:max-w-md xl:max-w-xl" />

              {secondaryLinks.map((link) => (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  className="hidden h-8 shrink-0 items-center px-2.5 text-[13px] font-medium tracking-[-0.01em] text-[var(--is-text-secondary)] transition-colors duration-200 hover:text-[var(--is-text)] lg:inline-flex"
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href={cta.href}
                className="hidden h-8 shrink-0 items-center px-3 text-[13px] font-medium tracking-[-0.01em] text-[var(--is-text-secondary)] ring-1 ring-[var(--is-border)] transition-colors duration-200 hover:text-[var(--is-text)] hover:ring-[var(--is-graphite-400)] sm:inline-flex"
              >
                {cta.label}
              </Link>

              <HeaderAuthActions auth={auth} />

              <MobileNavigation
                links={mobileLinks}
                auth={auth}
                primaryCta={cta}
                secondaryLinks={secondaryLinks}
              />
            </div>
          </div>

          <nav
            aria-label="Principal"
            className="hidden items-center gap-8 border-t border-[var(--is-border)] py-3.5 xl:flex"
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
      </header>
    </>
  );
}
