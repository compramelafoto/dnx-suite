import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { getAuthUser } from "@/lib/auth";
import { logoutAction } from "../actions";

export const metadata: Metadata = {
  title: "Acceso pendiente",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ notice?: string }>;

export default async function AccesoPendientePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const user = await getAuthUser();
  const notice =
    params.notice?.trim() ||
    "No tenés acceso editorial. Solicitá permisos al Director.";

  return (
    <PageShell
      title="Sin acceso editorial"
      description="Tu identidad DNX está lista; falta el rol editorial de Info Spot."
    >
      <div className="mx-auto w-full max-w-lg space-y-8">
        <p
          className="rounded-[var(--is-radius-sm)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 whitespace-pre-line"
          role="status"
        >
          {notice}
        </p>

        {user ? (
          <p className="text-sm leading-relaxed text-[var(--is-muted)]">
            Sesión: <span className="font-medium text-[var(--is-text)]">{user.email}</span>
          </p>
        ) : null}

        <p className="text-sm leading-relaxed text-[var(--is-muted)]">
          Los permisos se administran solo desde el panel del Director (
          <code className="text-xs">/admin/usuarios</code>). Cuando te asignen un rol activo,
          volvé a ingresar.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/ingresar"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 text-sm font-semibold text-[var(--is-text)]"
          >
            Volver a ingresar
          </Link>
          {user ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)]"
              >
                Cerrar sesión
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
