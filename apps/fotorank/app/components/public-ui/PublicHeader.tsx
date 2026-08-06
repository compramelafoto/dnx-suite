"use client";

import Image from "next/image";
import Link from "next/link";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "../../lib/cn";

export type PublicNavLink = { href: string; label: string };

export type PublicHeaderProps = {
  hasSession?: boolean;
  userEmail?: string | null;
  panelHref?: string;
  signOutAction?: () => Promise<void>;
  /** Compact sticky bar for contest / inscription; marketing = home shell. */
  variant?: "marketing" | "contest" | "participant";
  navLinks?: PublicNavLink[];
  className?: string;
};

const DEFAULT_MARKETING_LINKS: PublicNavLink[] = [
  { href: "/#concursos", label: "Concursos" },
  { href: "/#como-participar", label: "Cómo participar" },
  { href: "/#que-es", label: "Qué es FotoRank" },
];

/**
 * Header público unificado (home, concurso, participante).
 */
export function PublicHeader({
  hasSession = false,
  userEmail,
  panelHref = "/participaciones",
  signOutAction,
  variant = "contest",
  navLinks,
  className,
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const sticky = variant !== "marketing";
  const links = navLinks ?? (variant === "marketing" ? DEFAULT_MARKETING_LINKS : []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header
      className={cn(
        sticky ? "sticky top-0 z-40" : "fixed inset-x-0 top-0 z-40",
        "border-b border-[var(--border)] bg-[rgb(20_20_20_/_0.94)] backdrop-blur-md",
        className,
      )}
      data-public-header={variant}
    >
      <div className="fr-public-container flex min-h-[11.5rem] items-center justify-between gap-4 py-4 md:min-h-[14rem] lg:min-h-[16rem] lg:py-5">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center"
          aria-label="FotoRank — inicio"
          onClick={closeMenu}
        >
          <Image
            src="/fotorank-logo.png"
            alt="FotoRank"
            width={864}
            height={288}
            className="h-[10.5rem] w-auto max-w-[min(70vw,34rem)] object-contain object-left sm:h-[12rem] sm:max-w-[38rem] md:h-[13.5rem] md:max-w-[42rem] lg:h-[15rem] lg:max-w-[46rem]"
            priority
          />
        </Link>

        {links.length > 0 ? (
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Secciones">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <nav className="hidden items-center gap-3 md:flex" aria-label="Acciones de cuenta">
          {hasSession ? (
            <>
              {userEmail ? (
                <span className="max-w-[12rem] truncate text-sm text-[var(--foreground-muted)] lg:max-w-[14rem]">
                  {userEmail}
                </span>
              ) : null}
              <Link
                href={panelHref}
                className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                aria-label="Ir a mis participaciones"
              >
                <LayoutDashboard className="size-5" aria-hidden />
              </Link>
              {signOutAction ? (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--foreground)] transition-colors hover:border-[var(--primary)]"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut className="size-5" aria-hidden />
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <Link href="/login" className="fr-public-btn fr-public-btn--secondary min-h-11 px-5">
              Iniciar sesión
            </Link>
          )}
        </nav>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <div
          id={menuId}
          className="border-t border-[var(--border)] bg-[var(--background)] px-[var(--public-gutter)] py-8 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <ul className="space-y-6 text-lg">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[var(--foreground)]"
                  onClick={closeMenu}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/participaciones" className="text-[var(--foreground)]" onClick={closeMenu}>
                Mis participaciones
              </Link>
            </li>
            {hasSession ? (
              <li>
                <Link href={panelHref} className="text-[var(--primary)]" onClick={closeMenu}>
                  Ir a mi cuenta
                </Link>
              </li>
            ) : (
              <li>
                <Link href="/login" className="text-[var(--primary)]" onClick={closeMenu}>
                  Iniciar sesión
                </Link>
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
