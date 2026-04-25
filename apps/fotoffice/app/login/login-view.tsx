"use client";

import { useState } from "react";
import Link from "next/link";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { LoginForm } from "./login-form";

export function LoginView({
  initialAdminMode,
  dbUnavailable,
}: {
  initialAdminMode: boolean;
  dbUnavailable?: boolean;
}) {
  const [adminMode, setAdminMode] = useState(initialAdminMode);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--fo-bg)]">
      <div className="w-full max-w-md space-y-8">
        {dbUnavailable ? (
          <div className="fo-card fo-alert-warning text-left" role="status">
            <p className="text-sm font-medium text-[var(--fo-text)]">Base de datos no disponible</p>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              No se pudo cargar tu perfil para redirigirte. Podés intentar iniciar sesión cuando la base
              esté accesible; en desarrollo, comprobá Neon y la variable{" "}
              <code className="text-xs bg-[var(--fo-code-bg)] px-1 py-0.5 rounded border border-[var(--fo-border)]">
                DATABASE_URL
              </code>
              .
            </p>
          </div>
        ) : null}
        <div className="text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
            DNX Suite
          </p>
          <h1 className="sr-only">Fotoffice</h1>
          <FotofficeLogo variant="compact" priority />
          {adminMode ? (
            <>
              <p className="inline-flex items-center rounded-full border border-[var(--fo-accent)]/40 bg-[var(--fo-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--fo-accent)]">
                Acceso administración
              </p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed pt-1">
                Ingresá con una cuenta <strong className="text-[var(--fo-text)]">SUPER_ADMIN</strong>{" "}
                para el panel global. El resto de roles usa el acceso normal de workspace.
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Acceso con email y contraseña. Para el panel de administración de plataforma, usá{" "}
              <kbd className="px-1 py-0.5 rounded border border-[var(--fo-kbd-border)] bg-[var(--fo-kbd-bg)] font-mono text-[10px] shadow-[var(--fo-shadow-xs)]">
                Mayús
              </kbd>{" "}
              + «Iniciar sesión» desde el inicio, o{" "}
              <Link href="/login?admin=1" className="text-[var(--fo-accent)] underline">
                entrá aquí
              </Link>
              .
            </p>
          )}
        </div>
        <div className="fo-card">
          <LoginForm
            onSubmitButtonPointerDown={(e) => {
              if (e.shiftKey) setAdminMode(true);
            }}
          />
        </div>
        <p className="text-center text-xs text-[var(--fo-muted-soft)]">
          <Link href="/" className="underline hover:text-[var(--fo-muted)]">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
