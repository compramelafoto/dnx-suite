"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { RedaccionNav } from "@/components/redaccion/redaccion-nav";
import {
  isRedaccionEditorPath,
  redaccionEditorBackHref,
  redaccionEditorBackLabel,
} from "@/lib/redaccion-editor-routes";

const SIDEBAR_COLLAPSED_KEY = "infospot.redaccion.sidebarCollapsed";
const FOCUS_MODE_KEY = "infospot.redaccion.focusMode";

export type RedaccionShellClientProps = {
  variant?: "default" | "editor";
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Si se pasa, reemplaza el bloque título / descripción / acciones. */
  header?: ReactNode;
  /** Acciones del header de concentración (guardar, preview, CTA). */
  focusActions?: ReactNode;
  children: ReactNode;
  showAdmin: boolean;
  showUsers: boolean;
  showApprovals: boolean;
  userLabel: string;
  userInitial: string;
  userAvatarUrl: string | null;
};

function IconChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={collapsed ? "rotate-180" : undefined}
    >
      <path
        d="M10 3.5 5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3 5h12M3 9h12M3 13h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFocus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5.5 8h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditorFocusHeader({
  backHref,
  backLabel,
  focusMode,
  onToggleFocus,
  focusActions,
}: {
  backHref: string;
  backLabel: string;
  focusMode: boolean;
  onToggleFocus: () => void;
  focusActions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--is-border)] bg-[var(--is-bg)]/95 backdrop-blur-sm">
      <div className="flex min-h-14 items-center gap-3 px-4 py-2 sm:px-6">
        <Link
          href={backHref}
          className="shrink-0 text-sm font-medium text-[var(--is-accent)] hover:underline"
        >
          ← {backLabel}
        </Link>

        <div className="min-w-0 flex-1" />

        {focusActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">{focusActions}</div>
        ) : null}

        <button
          type="button"
          onClick={onToggleFocus}
          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 text-sm font-medium text-[var(--is-text-secondary)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
          aria-pressed={focusMode}
          aria-label={
            focusMode
              ? "Salir del modo concentración. Atajo: Control o Comando + Mayús + punto"
              : "Activar modo concentración. Atajo: Control o Comando + Mayús + punto"
          }
          title="Modo concentración (Ctrl/⌘+Shift+.)"
        >
          <IconFocus />
          <span className="hidden sm:inline">
            {focusMode ? "Salir concentración" : "Modo concentración"}
          </span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex size-10 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] text-[var(--is-muted)] hover:text-[var(--is-text)]"
            aria-label="Más acciones"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            ⋯
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 min-w-[12rem] rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white py-1 shadow-lg"
              >
                <Link
                  href={backHref}
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-[var(--is-text)] hover:bg-[var(--is-surface)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {backLabel}
                </Link>
                <Link
                  href="/redaccion"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-[var(--is-text)] hover:bg-[var(--is-surface)]"
                  onClick={() => setMenuOpen(false)}
                >
                  Ir a Redacción
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function RedaccionShellClient({
  variant,
  title,
  description,
  actions,
  header,
  focusActions,
  children,
  showAdmin,
  showUsers,
  showApprovals,
  userLabel,
  userInitial,
  userAvatarUrl,
}: RedaccionShellClientProps) {
  const pathname = usePathname() ?? "";
  const isEditor =
    variant === "editor" || (variant !== "default" && isRedaccionEditorPath(pathname));

  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerTitleId = useId();

  useEffect(() => {
    setMounted(true);
    try {
      const storedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (storedCollapsed === "1") setSidebarCollapsed(true);
      else if (storedCollapsed === "0") setSidebarCollapsed(false);
      else if (isEditor) setSidebarCollapsed(true);

      if (isEditor) {
        const storedFocus = localStorage.getItem(FOCUS_MODE_KEY);
        // Auto-enter focus on editor routes; honor explicit "0" to stay out.
        setFocusMode(storedFocus !== "0");
      } else {
        setFocusMode(false);
      }
    } catch {
      if (isEditor) {
        setSidebarCollapsed(true);
        setFocusMode(true);
      }
    }
  }, [isEditor]);

  const persistCollapsed = useCallback((next: boolean) => {
    setSidebarCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const persistFocus = useCallback(
    (next: boolean) => {
      setFocusMode(next);
      if (!isEditor) return;
      try {
        localStorage.setItem(FOCUS_MODE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [isEditor],
  );

  const toggleFocus = useCallback(() => {
    persistFocus(!focusMode);
  }, [focusMode, persistFocus]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.key !== "." && e.code !== "Period") return;
      e.preventDefault();
      setFocusMode((prev) => {
        const next = !prev;
        if (isEditor) {
          try {
            localStorage.setItem(FOCUS_MODE_KEY, next ? "1" : "0");
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditor]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const effectiveCollapsed = mounted ? sidebarCollapsed : false;
  const hideSidebar = focusMode;
  const showPageTitle = !isEditor && !header && Boolean(title);
  const shellMax = isEditor || focusMode ? "max-w-none" : "max-w-6xl";

  const asideInner = (
    <>
      {!effectiveCollapsed ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
            Info Spot
          </p>
          <p className="mt-1 text-sm text-[var(--is-muted)]">Redacción</p>
        </>
      ) : (
        <p
          className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--is-accent)]"
          title="Info Spot Redacción"
        >
          IS
        </p>
      )}

      {userLabel ? (
        <div
          className={[
            "mt-4 flex items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)]",
            effectiveCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-3",
          ].join(" ")}
          title={effectiveCollapsed ? userLabel : undefined}
        >
          {userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo (Google)
            <img
              src={userAvatarUrl}
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
              {userInitial}
            </span>
          )}
          {!effectiveCollapsed ? (
            <p className="min-w-0 truncate text-sm font-medium text-[var(--is-text)]">
              {userLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      <RedaccionNav
        showAdmin={showAdmin}
        showUsers={showUsers}
        showApprovals={showApprovals}
        collapsed={effectiveCollapsed}
        onNavigate={() => setMobileNavOpen(false)}
      />
    </>
  );

  return (
    <div className={isEditor ? "min-h-[100dvh] bg-[var(--is-bg)]" : undefined}>
      {isEditor ? (
        <EditorFocusHeader
          backHref={redaccionEditorBackHref(pathname)}
          backLabel={redaccionEditorBackLabel(pathname)}
          focusMode={focusMode}
          onToggleFocus={toggleFocus}
          focusActions={focusActions}
        />
      ) : null}

      <div
        className={[
          "mx-auto flex w-full flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10",
          shellMax,
          isEditor ? "py-4 lg:py-6" : "",
          hideSidebar ? "lg:justify-center" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Mobile top bar (non-focus / with sidebar available) */}
        {!hideSidebar ? (
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex size-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] text-[var(--is-text)]"
              aria-label="Abrir menú de redacción"
            >
              <IconMenu />
            </button>
            {!isEditor ? (
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
                  Info Spot
                </p>
                <p className="text-sm text-[var(--is-muted)]">Redacción</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--is-muted)]">Navegación</p>
            )}
            {!isEditor ? (
              <button
                type="button"
                onClick={toggleFocus}
                className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 text-xs font-medium text-[var(--is-text-secondary)]"
                aria-pressed={focusMode}
                aria-label="Modo concentración. Atajo: Control o Comando + Mayús + punto"
                title="Modo concentración (Ctrl/⌘+Shift+.)"
              >
                <IconFocus />
                Concentración
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Desktop sidebar */}
        {!hideSidebar ? (
          <aside
            className={[
              "hidden lg:sticky lg:top-8 lg:block lg:shrink-0 lg:self-start",
              effectiveCollapsed ? "lg:w-16" : "lg:w-60",
            ].join(" ")}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => persistCollapsed(!effectiveCollapsed)}
                className="inline-flex size-9 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] text-[var(--is-muted)] hover:text-[var(--is-accent)]"
                aria-label={
                  effectiveCollapsed
                    ? "Expandir barra lateral"
                    : "Colapsar barra lateral"
                }
                aria-pressed={effectiveCollapsed}
                title={effectiveCollapsed ? "Expandir" : "Colapsar"}
              >
                <IconChevron collapsed={effectiveCollapsed} />
              </button>
            </div>
            {asideInner}
            {!isEditor && !effectiveCollapsed ? (
              <button
                type="button"
                onClick={toggleFocus}
                className="mt-4 flex min-h-11 w-full items-center gap-2 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 text-left text-sm font-medium text-[var(--is-text-secondary)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
                aria-pressed={focusMode}
                aria-label="Modo concentración. Atajo: Control o Comando + Mayús + punto"
                title="Modo concentración (Ctrl/⌘+Shift+.)"
              >
                <IconFocus />
                Modo concentración
              </button>
            ) : null}
          </aside>
        ) : null}

        {/* Mobile drawer */}
        {mobileNavOpen && !hideSidebar ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-labelledby={drawerTitleId}>
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Cerrar menú"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col overflow-y-auto bg-[var(--is-bg)] p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p id={drawerTitleId} className="text-sm font-semibold text-[var(--is-text)]">
                  Redacción
                </p>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex size-10 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] text-sm"
                  aria-label="Cerrar menú"
                >
                  ✕
                </button>
              </div>
              <div className="[&_.justify-center]:justify-start">
                {/* Force expanded labels in drawer */}
                <RedaccionNavDrawerBody
                  showAdmin={showAdmin}
                  showUsers={showUsers}
                  showApprovals={showApprovals}
                  userLabel={userLabel}
                  userInitial={userInitial}
                  userAvatarUrl={userAvatarUrl}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Exit focus when not on editor chrome */}
        {hideSidebar && !isEditor ? (
          <div className="fixed bottom-6 right-6 z-30 lg:bottom-8 lg:right-8">
            <button
              type="button"
              onClick={toggleFocus}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 text-sm font-medium shadow-md hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
              aria-label="Salir del modo concentración. Atajo: Control o Comando + Mayús + punto"
            >
              <IconFocus />
              Salir concentración
            </button>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-6 pb-20 lg:pb-0">
          {header ? (
            header
          ) : showPageTitle ? (
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
    </div>
  );
}

function RedaccionNavDrawerBody({
  showAdmin,
  showUsers,
  showApprovals,
  userLabel,
  userInitial,
  userAvatarUrl,
  onNavigate,
}: {
  showAdmin: boolean;
  showUsers: boolean;
  showApprovals: boolean;
  userLabel: string;
  userInitial: string;
  userAvatarUrl: string | null;
  onNavigate: () => void;
}) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
        Info Spot
      </p>
      <p className="mt-1 text-sm text-[var(--is-muted)]">Redacción</p>
      {userLabel ? (
        <div className="mt-4 flex items-center gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)] px-3 py-3">
          {userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo (Google)
            <img
              src={userAvatarUrl}
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
              {userInitial}
            </span>
          )}
          <p className="min-w-0 truncate text-sm font-medium text-[var(--is-text)]">{userLabel}</p>
        </div>
      ) : null}
      <RedaccionNav
        showAdmin={showAdmin}
        showUsers={showUsers}
        showApprovals={showApprovals}
        collapsed={false}
        onNavigate={onNavigate}
      />
    </>
  );
}
