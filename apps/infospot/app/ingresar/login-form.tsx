"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({
  next,
  deniedMessage,
  oauthError,
}: {
  next: string;
  deniedMessage?: string | null;
  oauthError?: string | null;
}) {
  const [googlePending, setGooglePending] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  /** Errores reales de login/OAuth (rojo). El aviso `forbidden` es informativo. */
  const hardError = oauthError?.trim() || null;
  const softNotice = !hardError && deniedMessage ? deniedMessage : null;

  const googleHref = (() => {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (rememberMe) params.set("rememberMe", "1");
    const q = params.toString();
    return q ? `/api/auth/google?${q}` : "/api/auth/google";
  })();

  function startGoogle() {
    if (googlePending) return;
    setGooglePending(true);
    window.location.assign(googleHref);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      {hardError ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
          role="alert"
        >
          {hardError}
        </p>
      ) : null}

      {softNotice ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-4 py-3 text-sm leading-relaxed text-[var(--is-text-secondary)]"
          role="status"
        >
          {softNotice}
        </p>
      ) : null}

      <button
        type="button"
        onClick={startGoogle}
        disabled={googlePending}
        aria-busy={googlePending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-[var(--is-radius-sm)] border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa] hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285F4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon className="size-5 shrink-0" />
        {googlePending ? "Redirigiendo a Google…" : "Continuar con Google"}
      </button>

      <div className="flex items-center gap-4" role="separator" aria-label="o">
        <div className="h-px flex-1 bg-[var(--is-border)]" />
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--is-muted)]">
          o
        </span>
        <div className="h-px flex-1 bg-[var(--is-border)]" />
      </div>

      {/* Route Handler: Set-Cookie en el redirect (más fiable que Server Action + cookies()). */}
      <form action="/api/auth/login" method="post" className="space-y-8">
        <input type="hidden" name="next" value={next} />

        <div className="space-y-3">
          <label htmlFor="email" className="block text-sm font-semibold text-[var(--is-text)]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
            placeholder="tu@email.com"
          />
        </div>

        <div className="space-y-3">
          <label htmlFor="password" className="block text-sm font-semibold text-[var(--is-text)]">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-[var(--is-text)]">
          <input
            type="checkbox"
            name="rememberMe"
            className="size-4"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Recordarme en este dispositivo
        </label>

        <SubmitButton />

        <p className="text-center text-sm leading-relaxed text-[var(--is-muted)]">
          <Link
            href="/recuperar"
            className="font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </div>
  );
}
