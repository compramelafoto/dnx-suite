"use client";

import { useState } from "react";
import { AdminMobileNavigation } from "@/components/admin/AdminMobileNavigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

type Props = {
  userName: string | null;
  userEmail: string;
  mpConnected?: boolean;
  children: React.ReactNode;
};

export function AdminShell({
  userName,
  userEmail,
  mpConnected = false,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-ck-bg text-ck-text">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-dvh">
          <AdminSidebar />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          userName={userName}
          userEmail={userEmail}
          mpConnected={mpConnected}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <AdminMobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  );
}
