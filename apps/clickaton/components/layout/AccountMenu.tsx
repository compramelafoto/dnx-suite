"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { logoutClickatonAction } from "@/app/(public)/login/actions";
import { adminRoutes } from "@/config/admin/navigation";
import { CLICKATON_ACCOUNT_PATH } from "@/lib/auth/return-path";
import { cn } from "@/lib/cn";

export type HeaderAuthUser = {
  name: string | null;
  email: string;
  logoUrl: string | null;
  isAdmin: boolean;
};

type Props = {
  user: HeaderAuthUser;
  className?: string;
};

/* En pantallas chicas el menú se abre como hoja inferior; de md para arriba, como desplegable. */
const MOBILE_QUERY = "(max-width: 767px)";

function Avatar({
  user,
  initial,
  className,
}: {
  user: HeaderAuthUser;
  initial: string;
  className?: string;
}) {
  if (user.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.logoUrl}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ck-surface-strong font-bold text-ck-yellow",
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function MenuOptions({
  user,
  variant,
  onNavigate,
}: {
  user: HeaderAuthUser;
  variant: "dropdown" | "sheet";
  onNavigate: () => void;
}) {
  const itemClass = cn(
    "block w-full rounded-[var(--ck-radius-md)] text-left font-medium text-ck-text transition-colors duration-[var(--ck-duration-base)] hover:bg-ck-surface-strong hover:text-ck-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow",
    variant === "sheet"
      ? "min-h-14 px-4 py-4 text-base"
      : "min-h-11 px-3 py-2.5 text-sm",
  );

  return (
    <>
      <Link
        href={CLICKATON_ACCOUNT_PATH}
        role="menuitem"
        className={itemClass}
        onClick={onNavigate}
      >
        Mi cuenta
      </Link>
      {user.isAdmin ? (
        <Link
          href={adminRoutes.dashboard}
          role="menuitem"
          className={itemClass}
          onClick={onNavigate}
        >
          Panel administrativo
        </Link>
      ) : null}
      <form
        action={logoutClickatonAction}
        className="mt-1 border-t border-ck-border pt-1"
      >
        <button
          type="submit"
          role="menuitem"
          className={cn(
            itemClass,
            "text-ck-text-secondary hover:bg-ck-surface-strong hover:text-ck-danger",
          )}
        >
          Cerrar sesión
        </button>
      </form>
    </>
  );
}

export function AccountMenu({ user, className }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const displayName = user.name?.trim() || user.email.split("@")[0] || "Cuenta";
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      /* El velo no lleva el atributo: tocarlo cierra el menú. */
      if (target?.closest?.("[data-account-menu]")) return;
      setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  /* Con la hoja abierta el fondo no debe desplazarse. */
  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        data-account-menu
        type="button"
        className="inline-flex min-h-11 max-w-[14rem] items-center gap-2 rounded-[var(--ck-radius-control)] border border-ck-border-strong bg-ck-surface px-1.5 py-1.5 text-sm font-semibold text-ck-text transition hover:border-ck-yellow hover:text-ck-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow md:px-2.5"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar user={user} initial={initial} className="size-8 text-xs" />
        {/* En móvil sólo el avatar: el nombre desbordaba el encabezado. */}
        <span className="hidden truncate md:inline">{displayName}</span>
        <span className="sr-only md:hidden">Menú de {displayName}</span>
      </button>

      {open ? (
        <div
          data-account-menu
          id={panelId}
          role="menu"
          aria-label={`Menú de ${displayName}`}
          className="ck-menu-pop absolute right-0 z-50 mt-2 hidden w-64 rounded-[var(--ck-radius-lg)] border border-ck-border-strong bg-ck-surface-elevated p-2 shadow-[var(--ck-shadow-elevated)] md:block"
        >
          <p className="truncate border-b border-ck-border px-3 pb-2 pt-1 text-xs text-ck-text-muted">
            {user.email}
          </p>
          <div className="pt-1">
            <MenuOptions user={user} variant="dropdown" onNavigate={close} />
          </div>
        </div>
      ) : null}

      {open && mounted
        ? createPortal(
            <div className="md:hidden">
              <div
                className="ck-menu-veil fixed inset-0 z-[90] bg-[rgb(0_0_0_/_0.65)]"
                aria-hidden
                onClick={close}
              />
              <div
                data-account-menu
                id={`${panelId}-sheet`}
                role="menu"
                aria-label={`Menú de ${displayName}`}
                className="ck-menu-sheet fixed inset-x-0 bottom-0 z-[91] rounded-t-[var(--ck-radius-xl)] border-t border-ck-border-strong bg-ck-surface-elevated px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--ck-shadow-strong)]"
              >
                <span
                  aria-hidden
                  className="mx-auto mb-3 block h-1 w-10 rounded-full bg-ck-border-strong"
                />
                <div className="flex items-center gap-3 border-b border-ck-border px-2 pb-3">
                  <Avatar
                    user={user}
                    initial={initial}
                    className="size-11 text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ck-text">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-ck-text-muted">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <MenuOptions user={user} variant="sheet" onNavigate={close} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
