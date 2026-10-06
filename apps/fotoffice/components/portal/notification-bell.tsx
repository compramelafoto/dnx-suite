"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { badgeText, noticeKindLabel, relativeTime, type NoticeKind } from "@/lib/notifications/feed";

type NoticeJson = { key: string; kind: NoticeKind; title: string; body?: string | null; href: string; at: string };

/**
 * La campanita del portal: el numerito rojo cuenta lo que el socio todavía no vio; al abrirla se
 * despliega la lista de novedades y el numerito vuelve a cero.
 *
 * Las novedades se piden al abrir la página y no en el servidor del layout a propósito: así
 * ninguna pantalla del portal tarda más por armar la lista, y si algo falla la campanita
 * simplemente no muestra número, nunca rompe la página.
 */
export function NotificationBell() {
  const [items, setItems] = useState<NoticeJson[]>([]);
  const [unread, setUnread] = useState(0);
  const [visto, setVisto] = useState<number | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [cargando, setCargando] = useState(true);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/novedades", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: NoticeJson[]; unread: number; lastSeenAt: string | null };
      setItems(d.items);
      setUnread(d.unread);
      setVisto(d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : null);
    } catch {
      // Sin red o sin sesión: la campanita queda sin número.
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    // Cada cinco minutos, por si llega algo mientras el socio tiene la página abierta.
    const t = setInterval(() => void cargar(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierta]);

  function alternar() {
    const abrir = !abierta;
    setAbierta(abrir);
    if (abrir && unread > 0) {
      setUnread(0);
      // Se marca como visto al abrir. Los puntitos de "nuevo" se mantienen mientras siga abierta.
      void fetch("/api/portal/novedades", { method: "POST" }).catch(() => null);
    }
  }

  const ahora = new Date();
  const numero = badgeText(unread);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        aria-haspopup="true"
        aria-label={numero ? `Novedades: ${unread} sin ver` : "Novedades"}
        className="relative grid h-10 w-10 place-items-center rounded-full text-[var(--fo-text-secondary)] transition-colors hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {numero ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#dc2626] px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-[var(--fo-surface)]">
            {numero}
          </span>
        ) : null}
      </button>

      {abierta ? (
        <div
          role="dialog"
          aria-label="Novedades"
          className="fixed inset-x-2 top-20 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-md)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-[var(--fo-border)] px-4 py-3">
            <p className="text-sm font-semibold">Novedades</p>
            <button type="button" onClick={() => setAbierta(false)} className="text-xs text-[var(--fo-muted)] hover:underline">
              Cerrar
            </button>
          </div>
          <div className="overflow-y-auto">
            {cargando ? (
              <p className="px-4 py-6 text-sm text-[var(--fo-muted)]">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--fo-muted)]">No hay novedades por ahora.</p>
            ) : (
              <ul className="divide-y divide-[var(--fo-border-muted)]">
                {items.map((n) => {
                  const at = new Date(n.at);
                  const nueva = visto === null || at.getTime() > visto;
                  return (
                    <li key={n.key}>
                      <Link
                        href={n.href}
                        onClick={() => setAbierta(false)}
                        className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--fo-surface-hover)] ${nueva ? "bg-[var(--fo-accent-soft)]" : ""}`}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${nueva ? "bg-[#dc2626]" : "bg-transparent"}`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--fo-accent-hover)]">
                            {noticeKindLabel(n.kind)}
                          </span>
                          <span className="block text-sm font-medium text-[var(--fo-text)]">{n.title}</span>
                          {n.body ? <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">{n.body}</span> : null}
                          <span className="mt-0.5 block text-[11px] text-[var(--fo-muted-soft)]">{relativeTime(at, ahora)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
