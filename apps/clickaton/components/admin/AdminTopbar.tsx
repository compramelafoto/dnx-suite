"use client";

import { logoutAdminAction } from "@/app/admin/login/actions";
import { MercadoPagoConnectedIcon } from "@/components/admin/MercadoPagoConnectedIcon";
import { Button } from "@/components/ui/Button";

type Props = {
  userName: string | null;
  userEmail: string;
  mpConnected?: boolean;
  onOpenMobileNav: () => void;
};

export function AdminTopbar({
  userName,
  userEmail,
  mpConnected = false,
  onOpenMobileNav,
}: Props) {
  const display = userName?.trim() || userEmail;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ck-border bg-[rgb(17_17_17_/_0.92)] px-4 py-3 backdrop-blur-md sm:px-6">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--ck-radius-control)] border border-ck-border text-ck-text lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Abrir menú de administración"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-ck-text">
          <span className="truncate">{display}</span>
          {mpConnected ? <MercadoPagoConnectedIcon /> : null}
        </p>
        <p className="truncate text-xs text-ck-text-muted">{userEmail}</p>
      </div>

      <form action={logoutAdminAction}>
        <Button type="submit" variant="outline" size="sm">
          Cerrar sesión
        </Button>
      </form>
    </header>
  );
}
