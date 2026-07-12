import Link from "next/link";

type Props = {
  greeting: string;
  firstName: string;
  canCreate: boolean;
  canCreateFromClf: boolean;
  /** Director: acceso a asignación de roles. */
  canManageTeam?: boolean;
};

export function RedaccionWorkspaceHeader({
  greeting,
  firstName,
  canCreate,
  canCreateFromClf,
  canManageTeam = false,
}: Props) {
  return (
    <header className="relative overflow-hidden rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[linear-gradient(165deg,var(--is-white-0)_0%,var(--is-orange-50)_42%,var(--is-white-100)_100%)] px-5 py-8 sm:px-8 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--is-orange-100)] opacity-60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-[var(--is-graphite-100)] opacity-50 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
            Sala de redacción
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[clamp(1.85rem,1.4rem+1.6vw,2.75rem)] font-semibold leading-tight tracking-tight text-[var(--is-text)]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--is-text-secondary)]">
            Este es el estado actual de la redacción de Info Spot.
          </p>
        </div>

        {(canCreate || canCreateFromClf || canManageTeam) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {canCreate ? (
              <Link
                href="/redaccion/nueva"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--is-accent-hover)]"
              >
                Nueva nota
              </Link>
            ) : null}
            {canCreateFromClf ? (
              <Link
                href="/redaccion/desde-clf"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white/80 px-4 text-sm font-medium text-[var(--is-text)] backdrop-blur-sm transition-colors hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
              >
                Crear desde evento de ComprameLaFoto
              </Link>
            ) : null}
            {canManageTeam ? (
              <Link
                href="/admin/usuarios"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white/80 px-4 text-sm font-medium text-[var(--is-text)] backdrop-blur-sm transition-colors hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
              >
                Equipo y roles
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
