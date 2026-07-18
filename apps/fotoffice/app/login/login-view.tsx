"use client";

import { useState } from "react";
import Link from "next/link";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { LoginForm } from "./login-form";

export function LoginView({
  initialAdminMode,
  dbUnavailable,
  errorMessage,
}: {
  initialAdminMode: boolean;
  dbUnavailable?: boolean;
  errorMessage?: string | null;
}) {
  const [adminMode, setAdminMode] = useState(initialAdminMode);
  const [googleLoading, setGoogleLoading] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--fo-bg)]">
      <div className="w-full max-w-md space-y-8">
        {dbUnavailable ? (
          <div className="fo-card fo-alert-warning text-left" role="status">
            <p className="text-sm font-medium text-[var(--fo-text)]">Base de datos no disponible</p>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              No se pudo cargar tu perfil. Comprobá{" "}
              <code className="text-xs bg-[var(--fo-code-bg)] px-1 py-0.5 rounded border border-[var(--fo-border)]">
                DATABASE_URL
              </code>
              .
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="fo-card border border-red-500/30 bg-red-500/10 text-left" role="alert">
            <p className="text-sm text-[var(--fo-text)] leading-relaxed">{errorMessage}</p>
          </div>
        ) : null}

        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 shadow-sm">
            <FotofficeLogo variant="hero" priority />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--fo-text)] text-balance leading-[1.2]">
              Administrá tu negocio fotográfico en un solo lugar
            </h1>
            <p className="text-sm md:text-base text-[var(--fo-muted)] leading-relaxed text-balance">
              Ingresá con tu cuenta de fotógrafo para acceder a FotOffice y al ecosistema DNX.
            </p>
          </div>
        </div>

        <div className="fo-card space-y-6">
          {!adminMode ? (
            <>
              <a
                href="/api/auth/google"
                onClick={() => setGoogleLoading(true)}
                aria-busy={googleLoading}
                className="fo-btn fo-btn-primary w-full min-h-12 inline-flex items-center justify-center gap-3 text-base font-semibold"
              >
                {googleLoading ? (
                  <span>Conectando con Google…</span>
                ) : (
                  <>
                    <GoogleGlyph />
                    <span>Continuar con Google</span>
                  </>
                )}
              </a>
              <p className="text-center text-sm text-[var(--fo-muted)] leading-relaxed">
                Usá la misma cuenta que utilizás en ComprameLaFoto y FotoRank.
              </p>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-[var(--fo-border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[var(--fo-surface)] px-3 text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                    o email
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="inline-flex items-center rounded-full border border-[var(--fo-accent)]/40 bg-[var(--fo-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--fo-accent)]">
              Acceso administración
            </p>
          )}

          <LoginForm
            onSubmitButtonPointerDown={(e) => {
              if (e.shiftKey) setAdminMode(true);
            }}
          />
        </div>

        <p className="text-center text-xs text-[var(--fo-muted-soft)] leading-relaxed space-x-3">
          <Link href="/" className="underline hover:text-[var(--fo-muted)]">
            Volver al inicio
          </Link>
          <span aria-hidden>·</span>
          <Link href="/login?admin=1" className="underline hover:text-[var(--fo-muted)]">
            Admin
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.8 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.8-3.3-11.4-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l6.2 5.2C38.9 36.9 44 31.5 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
