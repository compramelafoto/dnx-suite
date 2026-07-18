import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import { siteConfig } from "@/config/site";
import { adminRoutes } from "@/config/admin/navigation";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
} from "@/lib/admin/auth";
import { friendlyGoogleLoginError } from "@/lib/auth/google-oauth";
import { resolveClickatonPostLoginPath } from "@/lib/auth/post-login";
import { sanitizeClickatonReturnPath } from "@/lib/auth/return-path";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function UnifiedLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = sanitizeClickatonReturnPath(sp.next);
  const oauthError = friendlyGoogleLoginError(sp.error);
  const user = await getClickatonAuthUser();

  if (user) {
    const destination = resolveClickatonPostLoginPath({
      email: user.email,
      globalRole: user.globalRole,
      next: nextPath,
    });
    // Si ya hay sesión y pidió admin sin permiso, acceso denegado (sesión intacta).
    if (
      nextPath.startsWith("/admin") &&
      !hasClickatonAdminAccess(user) &&
      destination.path === adminRoutes.forbidden
    ) {
      redirect(adminRoutes.forbidden);
    }
    redirect(destination.path);
  }

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-16 md:py-20">
      <Card variant="default" className="w-full max-w-md space-y-8">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
            {siteConfig.name}
          </p>
          <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
            Ingresá a Clickatón
          </h1>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Accedé con tu cuenta para participar, administrar tus inscripciones o
            gestionar Clickatón si tenés permisos.
          </p>
        </div>

        {oauthError ? (
          <p
            className="rounded-[var(--ck-radius-control)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger)]/10 px-4 py-3 text-sm text-[var(--ck-danger)]"
            role="alert"
          >
            {oauthError}
          </p>
        ) : null}

        <div className="space-y-6">
          <GoogleLoginButton nextPath={nextPath} />

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-ck-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-ck-card px-3 text-xs uppercase tracking-wide text-ck-text-muted">
                o ingresá con tu email
              </span>
            </div>
          </div>

          <LoginForm nextPath={nextPath} />
        </div>

        <p className="text-center text-sm text-ck-text-muted">
          <Link href="/" className="text-ck-yellow hover:underline">
            Volver al sitio público
          </Link>
        </p>
      </Card>
    </div>
  );
}
