"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { AdminDashboardAlert } from "@/lib/admin/admin-dashboard-alerts";

const STORAGE_KEY = "admin-notification-dismissed-ids";

function categoryStyle(category: AdminDashboardAlert["category"]): string {
  switch (category) {
    case "seguridad":
      return "bg-rose-900/40 text-rose-100 border border-rose-500/30";
    case "soporte":
      return "bg-sky-900/40 text-sky-100 border border-sky-500/30";
    case "pagos":
      return "bg-amber-900/40 text-amber-100 border border-amber-500/30";
    case "escuelas":
      return "bg-emerald-900/40 text-emerald-100 border border-emerald-500/30";
    case "comunidad":
      return "bg-violet-900/40 text-violet-100 border border-violet-500/30";
    case "marketing":
      return "bg-fuchsia-900/40 text-fuchsia-100 border border-fuchsia-500/30";
    default:
      return "bg-white/10 text-white/90 border border-white/15";
  }
}

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminDashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setDismissed(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/admin/notifications", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        /* */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function persistDismissed(next: string[]) {
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* */
    }
  }

  function markAllRead() {
    const all = items.map((i) => i.id);
    persistDismissed([...new Set([...dismissed, ...all])]);
  }

  const unreadCount = items.filter((i) => !dismissed.includes(i.id)).length;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        id="admin-notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/15 transition-colors touch-manipulation"
        aria-expanded={open}
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ""}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none min-w-[1.125rem] px-1 py-0.5 rounded-full text-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(100vw-1.5rem,22rem)] max-h-[min(70vh,24rem)] overflow-hidden rounded-lg border border-white/15 bg-[#0f172a] shadow-2xl z-[80] flex flex-col"
          role="dialog"
          aria-label="Centro de notificaciones"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Alertas</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-white/70 hover:text-white underline-offset-2 hover:underline"
              >
                Marcar como leídas
              </button>
            )}
          </div>
          <div className="overflow-y-auto overscroll-contain flex-1 p-2 space-y-1.5">
            {loading && <p className="text-sm text-white/60 px-2 py-3">Cargando…</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-white/60 px-2 py-4">No hay alertas por ahora.</p>
            )}
            {!loading &&
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link}
                  onClick={() => {
                    if (!dismissed.includes(item.id)) {
                      persistDismissed([...dismissed, item.id]);
                    }
                    setOpen(false);
                  }}
                  className="block rounded-md px-2.5 py-2 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${categoryStyle(
                        item.category
                      )}`}
                    >
                      {item.category}
                    </span>
                    {item.count > 1 && (
                      <span className="shrink-0 text-xs font-semibold text-amber-300/90">×{item.count}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white mt-1 leading-snug">{item.title}</p>
                  <p className="text-xs text-white/65 mt-0.5 leading-snug">{item.message}</p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
