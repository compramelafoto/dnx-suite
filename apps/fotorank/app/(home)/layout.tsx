import Link from "next/link";
import { requireAuth } from "../lib/auth";
import { resolveHomeCapabilities } from "../lib/fotorank/access/home-capabilities";
import { landingSignOutAction } from "../actions/landing-session";

/**
 * Shell del hub personal unificado (ETAPA 09B).
 * Cambio de contexto solo desde el menú lateral — nunca antes del login.
 */
export default async function HomeShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const caps = await resolveHomeCapabilities({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  const nav: { href: string; label: string }[] = [
    { href: "/mi-actividad", label: "Mi actividad" },
  ];
  if (caps.hasParticipations || caps.kinds.length === 0) {
    nav.push({ href: "/participaciones", label: "Participaciones" });
  }
  if (caps.hasOrganizations) {
    nav.push({ href: "/dashboard", label: "Organizaciones" });
  }
  if (caps.hasJuryAccount) {
    nav.push({ href: "/jurado/panel", label: "Tareas de jurado" });
  }
  if (caps.isSuperAdmin) {
    nav.push({ href: "/super-admin", label: "Super Administración" });
  }

  return (
    <div className="min-h-screen bg-fr-bg text-fr-primary">
      <div className="mx-auto flex min-h-screen max-w-[80rem] flex-col gap-0 lg:flex-row">
        <aside className="w-full shrink-0 border-b border-fr-border bg-fr-bg-elevated lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-8 px-6 py-8 lg:sticky lg:top-0 lg:min-h-screen lg:px-8 lg:py-10">
            <div className="space-y-2">
              <p className="fr-eyebrow text-gold">FotoRank</p>
              <p className="truncate text-sm font-semibold text-fr-primary">
                {user.name?.trim() || user.email}
              </p>
              <p className="truncate text-xs text-fr-muted">{user.email}</p>
            </div>
            <nav className="flex flex-col gap-3" aria-label="Contexto personal">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-fr-muted transition-colors hover:bg-fr-card hover:text-gold"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action={landingSignOutAction} className="mt-auto border-t border-fr-border pt-8">
              <button
                type="submit"
                className="w-full rounded-lg border border-fr-border px-4 py-3 text-left text-sm text-fr-muted transition-colors hover:border-gold/40 hover:text-gold"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-12 md:px-10 lg:px-12">{children}</main>
      </div>
    </div>
  );
}
