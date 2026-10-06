"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { moveSelection, shouldIgnoreShortcut } from "./keyboard";
import { groupResults, matchEntries } from "./match";
import type { QuickSearchEntry } from "./types";

export type QuickSearchProps = {
  /** El menú ya filtrado por permisos. El buscador no decide qué puede ver nadie. */
  entries: QuickSearchEntry[];
  /** Cómo se navega. Cada app pasa `router.push`: el paquete no conoce Next. */
  onNavigate: (href: string) => void;
  /** Solo la lupa, para el menú colapsado. */
  compact?: boolean;
  placeholder?: string;
  /** Texto del botón. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  /**
   * Colores de la app, como variables `--qs-*` (ver `V`). Se aplican al botón y a la ventana,
   * que se dibuja aparte, sobre toda la página, y no hereda nada del menú.
   */
  theme?: QuickSearchTheme;
};

export type QuickSearchTheme = Partial<
  Record<
    | "bg"
    | "fg"
    | "muted"
    | "border"
    | "hover"
    | "active"
    | "accent"
    | "triggerBg"
    | "overlay",
    string
  >
>;

function themeVars(theme: QuickSearchTheme | undefined): CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme)) {
    if (!v) continue;
    const nombre = k === "triggerBg" ? "trigger-bg" : k;
    vars[`--qs-${nombre}`] = v;
  }
  return vars as CSSProperties;
}

/**
 * Los colores salen de variables CSS que cada app puede definir (`--qs-*`). Los valores por
 * defecto son neutros y sirven en fondo claro; una app con tema oscuro los pisa.
 */
const V = {
  bg: "var(--qs-bg, #ffffff)",
  fg: "var(--qs-fg, #0f172a)",
  muted: "var(--qs-muted, #64748b)",
  border: "var(--qs-border, rgba(15, 23, 42, 0.12))",
  hover: "var(--qs-hover, rgba(15, 23, 42, 0.05))",
  active: "var(--qs-active, rgba(37, 99, 235, 0.10))",
  accent: "var(--qs-accent, #2563eb)",
  trigger: "var(--qs-trigger-bg, rgba(15, 23, 42, 0.04))",
  overlay: "var(--qs-overlay, rgba(15, 23, 42, 0.45))",
};

/** Solo una instancia puede abrirse por tecla: hay apps con el menú montado dos veces. */
let abiertaPorAtajo = false;

function esMac(): boolean {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

function Lupa({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function QuickSearch({
  entries,
  onNavigate,
  compact = false,
  placeholder = "Buscar una sección u opción…",
  label = "Buscar",
  className,
  style,
  theme,
}: QuickSearchProps) {
  const vars = themeVars(theme);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [mac, setMac] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setMounted(true);
    setMac(esMac());
  }, []);

  const results = useMemo(() => matchEntries(entries, query), [entries, query]);
  const groups = useMemo(() => groupResults(results), [results]);

  const cerrar = useCallback(() => {
    setOpen(false);
    abiertaPorAtajo = false;
    triggerRef.current?.focus();
  }, []);

  const abrir = useCallback(() => {
    setQuery("");
    setSelected(0);
    setOpen(true);
  }, []);

  // ⌘K / Ctrl+K desde cualquier lado; "/" solo cuando no se está escribiendo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const atajo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const barra = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!atajo && !barra) return;
      const el = e.target as HTMLElement | null;
      if (barra && shouldIgnoreShortcut(el?.tagName, el?.isContentEditable)) return;
      // Si el menú está montado dos veces (teléfono y computadora), abre el que se ve.
      const visible = triggerRef.current?.offsetParent != null;
      if (!visible || abiertaPorAtajo) return;
      e.preventDefault();
      abiertaPorAtajo = true;
      abrir();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-qs-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const ir = useCallback(
    (entry: QuickSearchEntry | undefined) => {
      if (!entry) return;
      setOpen(false);
      abiertaPorAtajo = false;
      onNavigate(entry.href);
    },
    [onNavigate],
  );

  function onInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => moveSelection(s, results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => moveSelection(s, results.length, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(results[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    }
  }

  const tecla = mac ? "⌘K" : "Ctrl K";

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={abrir}
      aria-label={`${label} (${tecla})`}
      title={`${label} (${tecla})`}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: compact ? "auto" : "100%",
        padding: compact ? 8 : "8px 10px",
        borderRadius: 10,
        border: `1px solid ${V.border}`,
        background: V.trigger,
        color: V.muted,
        fontFamily: "inherit",
        fontSize: 14,
        lineHeight: "20px",
        cursor: "pointer",
        justifyContent: compact ? "center" : "flex-start",
        ...vars,
        ...style,
      }}
    >
      <Lupa />
      {!compact && (
        <>
          <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
          <kbd
            style={{
              fontFamily: "inherit",
              fontSize: 11,
              padding: "1px 6px",
              borderRadius: 6,
              border: `1px solid ${V.border}`,
              color: V.muted,
            }}
          >
            {tecla}
          </kbd>
        </>
      )}
    </button>
  );

  let index = -1;

  const dialog = open ? (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
      style={{
        ...vars,
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: V.overlay,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "12vh 16px 16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en el menú"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          background: V.bg,
          color: V.fg,
          borderRadius: 14,
          border: `1px solid ${V.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          overflow: "hidden",
          fontSize: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: `1px solid ${V.border}`,
            color: V.muted,
          }}
        >
          <Lupa size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${selected}` : undefined}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              border: 0,
              outline: "none",
              background: "transparent",
              color: V.fg,
              fontFamily: "inherit",
              fontSize: 16,
              minWidth: 0,
            }}
          />
          <kbd
            onClick={cerrar}
            style={{
              fontFamily: "inherit",
              fontSize: 11,
              padding: "1px 6px",
              borderRadius: 6,
              border: `1px solid ${V.border}`,
              cursor: "pointer",
            }}
          >
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ overflowY: "auto", padding: 6 }}
        >
          {results.length === 0 ? (
            <p style={{ padding: "24px 12px", textAlign: "center", color: V.muted, margin: 0 }}>
              No encontramos nada con “{query}”. Probá con otra palabra.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group}>
                <div
                  style={{
                    padding: "8px 10px 4px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: V.muted,
                  }}
                >
                  {g.group}
                </div>
                {g.entries.map((entry) => {
                  index += 1;
                  const i = index;
                  const activo = i === selected;
                  return (
                    <div
                      key={entry.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={activo}
                      data-qs-index={i}
                      onMouseMove={() => {
                        if (selected !== i) setSelected(i);
                      }}
                      onClick={() => ir(entry)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: activo ? V.active : "transparent",
                      }}
                    >
                      {entry.icon ? (
                        <span
                          style={{
                            display: "inline-flex",
                            color: activo ? V.accent : V.muted,
                            flexShrink: 0,
                          }}
                        >
                          {entry.icon}
                        </span>
                      ) : null}
                      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontWeight: 500 }}>{entry.label}</span>
                        {entry.description ? (
                          <span
                            style={{
                              fontSize: 12,
                              color: V.muted,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {entry.description}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "8px 14px",
            borderTop: `1px solid ${V.border}`,
            fontSize: 12,
            color: V.muted,
          }}
        >
          <span>↑ ↓ para moverte</span>
          <span>Enter para ir</span>
          <span>Esc para cerrar</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
