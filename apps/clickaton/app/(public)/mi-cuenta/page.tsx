import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { logoutClickatonAction } from "@/app/(public)/login/actions";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
} from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

export default async function MiCuentaPage() {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent("/mi-cuenta")}`);
  }

  const isAdmin = hasClickatonAdminAccess(user);
  const displayName = user.name?.trim() || "participante";
  const initial = (user.name?.trim() || user.email).charAt(0).toUpperCase();
  const authMethod = user.emailVerifiedAt
    ? "Cuenta DNX Identity (email verificado)"
    : "Cuenta DNX Identity";

  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:py-20">
      <Card variant="default" className="space-y-8">
        <div className="flex items-start gap-4">
          {user.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo Google
            <img
              src={user.logoUrl}
              alt=""
              className="size-14 shrink-0 rounded-full border border-ck-border object-cover"
            />
          ) : (
            <span
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-ck-border bg-ck-surface-strong text-lg font-semibold text-ck-yellow"
              aria-hidden
            >
              {initial}
            </span>
          )}
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
              Mi cuenta
            </p>
            <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
              Hola, {displayName}
            </h1>
            <p className="truncate text-sm text-ck-text-secondary">{user.email}</p>
            <p className="text-xs text-ck-text-muted">{authMethod}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isAdmin ? (
            <Button href={adminRoutes.dashboard} variant="primary">
              Panel administrativo
            </Button>
          ) : null}
          <Button href="/" variant="secondary">
            Ir al sitio público
          </Button>
          <form action={logoutClickatonAction}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              Cerrar sesión
            </Button>
          </form>
        </div>

        <p className="text-sm text-ck-text-muted">
          Las inscripciones y el historial de participación se habilitarán en etapas
          siguientes.{" "}
          <Link href="/maratones" className="text-ck-yellow hover:underline">
            Ver maratones
          </Link>
        </p>
      </Card>
    </div>
  );
}
