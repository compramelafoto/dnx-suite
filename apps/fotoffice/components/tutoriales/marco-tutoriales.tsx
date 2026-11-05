import Link from "next/link";
import type { ReactNode } from "react";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { EnlaceIngresar } from "@/components/landing/enlace-ingresar";

/** La barra y el pie de las páginas públicas de los tutoriales: se leen sin haber entrado. */
export function MarcoTutoriales({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <header className="border-b border-[var(--fo-border)] bg-[var(--fo-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="FOTOFFICE, inicio">
            <FotofficeLogo variant="landing" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/tutoriales"
              className="rounded-[var(--fo-radius-sm)] px-3 py-2 text-[var(--fo-text-secondary)] hover:bg-[var(--fo-surface-hover)]"
            >
              Tutoriales
            </Link>
            <EnlaceIngresar className="fo-btn fo-btn-primary">Entrar</EnlaceIngresar>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:pt-14">{children}</main>
      <footer className="border-t border-[var(--fo-border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 text-xs text-[var(--fo-muted)]">
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <span>FOTOFFICE es parte de DNX Suite.</span>
        </div>
      </footer>
    </div>
  );
}
