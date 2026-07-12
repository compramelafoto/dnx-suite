import type { ReactNode } from "react";
import { getAuthUser } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canManageInfoSpotUsers,
  canReviewInfoSpotApprovals,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { RedaccionNav } from "@/components/redaccion/redaccion-nav";

export async function RedaccionShell({
  title,
  description,
  actions,
  header,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Si se pasa, reemplaza el bloque título / descripción / acciones. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const user = await getAuthUser();
  const membership = user ? await getInfoSpotMembership(user.id) : null;
  const subject = user ? toPermissionSubject(user, membership) : null;
  const showAdmin = canAccessInfoSpotAdmin(subject);
  const showUsers = canManageInfoSpotUsers(subject);
  const showApprovals = canReviewInfoSpotApprovals(subject);

  const label = user?.name?.trim() || user?.email || "";
  const initial = (label.trim()[0] || "?").toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
      <aside className="lg:sticky lg:top-8 lg:w-60 lg:shrink-0 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
          Info Spot
        </p>
        <p className="mt-1 text-sm text-[var(--is-muted)]">Redacción</p>

        {user ? (
          <div className="mt-4 flex items-center gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)] px-3 py-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar externo (Google)
              <img
                src={user.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold text-[var(--is-muted)]"
              >
                {initial}
              </span>
            )}
            <p className="min-w-0 truncate text-sm font-medium text-[var(--is-text)]">{label}</p>
          </div>
        ) : null}

        <RedaccionNav
          showAdmin={showAdmin}
          showUsers={showUsers}
          showApprovals={showApprovals}
        />
      </aside>

      <div className="min-w-0 flex-1 space-y-6 pb-20 lg:pb-0">
        {header ? (
          header
        ) : title ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--is-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
            {actions}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
