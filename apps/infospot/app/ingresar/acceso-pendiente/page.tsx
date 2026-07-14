import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { getAuthUser } from "@/lib/auth";
import { logoutAction } from "../actions";

export const metadata: Metadata = {
  title: "Sin acceso a Redacción",
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
    "Tu cuenta está activa, pero todavía no tiene acceso a la Redacción.";

  return (
    <PageShell
      title="Sin acceso a la Redacción"
      description="Tu cuenta pública de Info Spot funciona; el acceso editorial es solo por invitación."
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
            Sesión activa. Esto no bloquea el resto del sitio.
          </p>
        ) : null}

        <p className="text-sm leading-relaxed text-[var(--is-muted)]">
          Si te invitaron al equipo, usá el enlace de invitación. El Director asigna roles
          desde el panel interno; no hay autoasignación.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)]"
          >
            Volver a Info Spot
          </Link>
          <Link
            href="/ingresar"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 text-sm font-semibold text-[var(--is-text)]"
          >
            Aceptar una invitación
          </Link>
          {user ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-semibold text-[var(--is-text)]"
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
