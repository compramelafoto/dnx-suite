"use client";

import { useEffect, useId, useRef, useState } from "react";
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

export function AccountMenu({ user, className }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const displayName = user.name?.trim() || user.email.split("@")[0] || "Cuenta";
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex min-h-11 max-w-[14rem] items-center gap-2 rounded-[var(--ck-radius-control)] border border-ck-border-strong bg-ck-surface px-2.5 py-1.5 text-sm font-semibold text-ck-text transition hover:border-ck-yellow hover:text-ck-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {user.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.logoUrl}
            alt=""
            className="size-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ck-surface-strong text-xs font-bold text-ck-yellow"
            aria-hidden
          >
            {initial}
          </span>
        )}
        <span className="truncate">{displayName}</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-card p-2 shadow-[var(--ck-shadow-elevated)]"
        >
          <p className="truncate px-3 py-2 text-xs text-ck-text-muted">{user.email}</p>
          <Link
            href={CLICKATON_ACCOUNT_PATH}
            role="menuitem"
            className="block rounded-[var(--ck-radius-sm)] px-3 py-2.5 text-sm font-medium text-ck-text hover:bg-ck-surface-strong hover:text-ck-yellow"
            onClick={() => setOpen(false)}
          >
            Mi cuenta
          </Link>
          {user.isAdmin ? (
            <Link
              href={adminRoutes.dashboard}
              role="menuitem"
              className="block rounded-[var(--ck-radius-sm)] px-3 py-2.5 text-sm font-medium text-ck-text hover:bg-ck-surface-strong hover:text-ck-yellow"
              onClick={() => setOpen(false)}
            >
              Panel administrativo
            </Link>
          ) : null}
          <form action={logoutClickatonAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-[var(--ck-radius-sm)] px-3 py-2.5 text-left text-sm font-medium text-ck-text hover:bg-ck-surface-strong hover:text-ck-yellow"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
