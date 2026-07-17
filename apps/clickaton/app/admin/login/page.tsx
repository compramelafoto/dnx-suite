import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/admin/login/LoginForm";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { siteConfig } from "@/config/site";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
  sanitizeAdminReturnPath,
} from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = sanitizeAdminReturnPath(sp.next);
  const user = await getClickatonAuthUser();
  if (user && hasClickatonAdminAccess(user)) {
    redirect(nextPath);
  }
  if (user && !hasClickatonAdminAccess(user)) {
    redirect(adminRoutes.forbidden);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ck-bg px-4 py-12">
      <Card variant="default" className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
            {siteConfig.name}
          </p>
          <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
            Acceso al panel
          </h1>
          <p className="text-sm text-ck-text-secondary">
            Ingresá con tu cuenta DNX Identity. Solo administradores autorizados de Clickatón.
          </p>
        </div>
        <LoginForm nextPath={nextPath} />
        <p className="text-center text-sm text-ck-text-muted">
          <Link href="/" className="text-ck-yellow hover:underline">
            Volver al sitio público
          </Link>
        </p>
      </Card>
    </div>
  );
}
