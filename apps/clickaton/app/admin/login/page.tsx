import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/app/admin/login/GoogleLoginButton";
import { LoginForm } from "@/app/admin/login/LoginForm";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { siteConfig } from "@/config/site";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
  sanitizeAdminReturnPath,
} from "@/lib/admin/auth";
import { friendlyGoogleLoginError } from "@/lib/admin/google-oauth";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = sanitizeAdminReturnPath(sp.next);
  const oauthError = friendlyGoogleLoginError(sp.error);
  const user = await getClickatonAuthUser();
  if (user && hasClickatonAdminAccess(user)) {
    redirect(nextPath);
  }
  if (user && !hasClickatonAdminAccess(user)) {
    redirect(adminRoutes.forbidden);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ck-bg px-4 py-12">
      <Card variant="default" className="w-full max-w-md space-y-8">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
            {siteConfig.name}
          </p>
          <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
            Acceso al panel de Clickatón
          </h1>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Ingresá con Google o con tu email y contraseña de DNX Identity. Solo
            administradores autorizados acceden al panel.
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
                o email
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
