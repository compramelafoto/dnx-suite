"use client";

import { useEffect, useId, useRef } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AdminMobileNavigation({ open, onClose }: Props) {
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/70 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        aria-label="Cerrar menú"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de administración"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="absolute right-3 top-3 z-10">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface text-ck-text"
            aria-label="Cerrar menú de administración"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <AdminSidebar onNavigate={onClose} className="w-full" />
      </div>
    </div>
  );
}
