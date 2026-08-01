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
          Sin permiso
        </p>
        <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
          No tenés permiso para acceder a esta sección
        </h1>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          La sesión activa ({user.email}) no está autorizada para administrar Clickatón. Podés
          volver al sitio o comunicarte con un administrador si necesitás acceso.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={CLICKATON_ACCOUNT_PATH} variant="primary" className="min-h-11">
            Ir a Mi cuenta
          </Button>
          <Button href="/" variant="secondary" className="min-h-11">
            Volver al inicio
          </Button>
          <form action={logoutClickatonAction}>
            <Button type="submit" variant="outline" className="min-h-11">
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
