"use client";

import Link from "next/link";
import { FotofficeLogo } from "@/components/fotoffice-logo";

/**
 * Mayús + clic en «Iniciar sesión» abre el login en variante administración (`/login?admin=1`).
 */
export function FotofficeHomeEntry({ dbUnavailable }: { dbUnavailable?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--fo-bg)]">
      <div className="w-full max-w-lg text-center space-y-10">
        {dbUnavailable ? (
          <div className="fo-card fo-alert-warning text-left" role="status">
            <p className="text-sm font-medium text-[var(--fo-text)]">Base de datos no disponible</p>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              No se pudo cargar tu perfil. Revisá que el servidor PostgreSQL (Neon) esté en línea y que{" "}
              <code className="text-xs bg-[var(--fo-code-bg)] px-1 py-0.5 rounded border border-[var(--fo-border)]">
                DATABASE_URL
              </code>{" "}
              sea correcta en tu entorno.
            </p>
          </div>
        ) : null}
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
            DNX Suite
          </p>
          <h1 className="sr-only">Fotoffice</h1>
          <FotofficeLogo variant="hero" priority />
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed max-w-md mx-auto">
            Venta de cursos y administración por workspace. Iniciá sesión para continuar.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link
            href="/login"
            onClick={(e) => {
              if (e.shiftKey) {
                e.preventDefault();
                window.location.assign("/login?admin=1");
              }
            }}
            className="fo-btn fo-btn-primary text-base min-h-12 px-8 justify-center"
          >
            Iniciar sesión
          </Link>
        </div>
        <p className="text-xs text-[var(--fo-muted-soft)] max-w-sm mx-auto leading-relaxed">
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--fo-kbd-border)] bg-[var(--fo-kbd-bg)] font-mono text-[10px] shadow-[var(--fo-shadow-xs)]">
            Mayús
          </kbd>{" "}
          + clic en «Iniciar sesión» para el acceso de administración de plataforma.
        </p>
      </div>
    </div>
  );
}
