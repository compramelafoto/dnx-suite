import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/app/admin/login/GoogleLoginButton";
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
            Ingresá con tu cuenta de Google autorizada para administrar Clickatón.
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

        <GoogleLoginButton nextPath={nextPath} />

        <p className="text-center text-sm text-ck-text-muted">
          <Link href="/" className="text-ck-yellow hover:underline">
            Volver al sitio público
          </Link>
        </p>
      </Card>
    </div>
  );
}
