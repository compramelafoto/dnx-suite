import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { redirect } from "next/navigation";

export default async function AdminForbiddenPage() {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(adminRoutes.login);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ck-bg px-4 py-12">
      <Card variant="outlined" className="w-full max-w-lg space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ck-danger)]">
          Acceso denegado
        </p>
        <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
          Sin permiso para el panel
        </h1>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          La sesión activa ({user.email}) no está autorizada para administrar Clickatón. Si
          necesitás acceso, contactá a un administrador DNX.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href="/" variant="secondary">
            Ir al sitio público
          </Button>
          <form action={logoutAdminAction}>
            <Button type="submit" variant="outline">
              Cerrar sesión
            </Button>
          </form>
        </div>
        <p className="text-sm text-ck-text-muted">
          <Link href={adminRoutes.login} className="text-ck-yellow hover:underline">
            Probar con otra cuenta
          </Link>
        </p>
      </Card>
    </div>
  );
}
