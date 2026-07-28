import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  logoutClickatonAction,
  logoutClickatonToLoginAction,
} from "@/app/(public)/login/actions";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import {
  CLICKATON_ACCOUNT_PATH,
  CLICKATON_LOGIN_PATH,
} from "@/lib/auth/return-path";

export default async function AdminForbiddenPage() {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent("/admin")}`);
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
          La sesión activa ({user.email}) no está autorizada para administrar Clickatón.
          Podés seguir usando el sitio como usuario. Si necesitás acceso, contactá a un
          administrador DNX.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={CLICKATON_ACCOUNT_PATH} variant="primary">
            Ir a mi cuenta
          </Button>
          <Button href="/" variant="secondary">
            Ir al sitio público
          </Button>
          <form action={logoutClickatonAction}>
            <Button type="submit" variant="outline">
              Cerrar sesión
            </Button>
          </form>
        </div>
        <form action={logoutClickatonToLoginAction}>
          <button
            type="submit"
            className="text-sm text-ck-yellow hover:underline"
          >
            Probar con otra cuenta
          </button>
        </form>
      </Card>
    </div>
  );
}
