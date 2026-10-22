"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  anyReferenceGuideOn,
  toggleAllReferenceGuides,
  type ReferenceGuideKey,
  type ReferenceGuideSettings,
} from "@repo/template-editor-core";
import { useEditorThemeStyle } from "./theme-context";
import { cn } from "./primitives/cn";

type Props = {
  value: ReferenceGuideSettings;
  onChange: (next: ReferenceGuideSettings) => void;
  /** La hoja es un librito abierto: la mitad vertical se nombra como el pliegue. */
  isSpread: boolean;
  disabled?: boolean;
};

/**
 * Botón «Guías» de la barra del editor: un menú de casillas para prender y apagar las guías de
 * referencia (mitades, cuartos y el centro de cada cara). Va por portal porque los grupos de la
 * barra recortan lo que se sale de ellos.
 */
export function ReferenceGuidesMenu({ value, onChange, isSpread, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const themeStyle = useEditorThemeStyle();
  const width = 268;

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const items: Array<{ key: ReferenceGuideKey; label: string; hint: string }> = [
    {
      key: "fold",
      label: isSpread ? "Mitad vertical (pliegue)" : "Mitad vertical",
      hint: "La línea que separa contratapa y tapa, o la página izquierda de la derecha.",
    },
    { key: "halfH", label: "Mitad horizontal", hint: "La mitad del alto de la hoja." },
    {
      key: "quartersV",
      label: "Centro de cada cara (cuartos)",
      hint: "Líneas al 25 % y al 75 % del ancho: el centro de cada cara del librito abierto.",
    },
    { key: "quartersH", label: "Cuartos horizontales", hint: "Líneas al 25 % y al 75 % del alto." },
    { key: "faceCenters", label: "Crucecita en el centro de cada cara", hint: "Marca el punto medio de cada cara." },
  ];
  const anyOn = anyReferenceGuideOn(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title="Guías de referencia: pliegue, mitades y centro de cada cara (no se imprimen)"
        aria-label="Guías de referencia"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="template-v2-reference-guides-button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[var(--te-control)] shrink-0 items-center gap-1 border-0 bg-transparent px-2 text-[12px] font-medium transition-colors",
          "text-[color:var(--te-ink-muted)]",
          "hover:enabled:bg-[color:var(--te-chrome-sunken)] hover:enabled:text-[color:var(--te-ink)]",
          "disabled:cursor-default disabled:opacity-40",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--te-accent)]",
          (anyOn || open) && "bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]",
        )}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
          <path d="M12 4.5v15" strokeDasharray="2.5 2" />
          <path d="M7.75 10.5v3M6.25 12h3M16.25 10.5v3M14.75 12h3" strokeLinecap="round" />
        </svg>
        <span>Guías</span>
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label="Guías de referencia"
              data-testid="template-v2-reference-guides-menu"
              style={{ ...themeStyle, position: "fixed", top: pos.top, left: pos.left, width }}
              className="z-[210] rounded-xl border border-[color:var(--te-line)] bg-[color:var(--te-surface)] py-1.5 text-[12px] text-[color:var(--te-ink)] shadow-xl"
            >
              <p className="m-0 px-3 pb-1 pt-0.5 text-[11px] text-[color:var(--te-ink-muted)]">
                Sólo se ven en pantalla: no salen en la impresión.
              </p>
              {items.map((it) => (
                <label
                  key={it.key}
                  role="menuitemcheckbox"
                  aria-checked={value[it.key]}
                  title={it.hint}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-[color:var(--te-chrome-sunken)]"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[color:var(--te-accent)]"
                    checked={value[it.key]}
                    onChange={(e) => onChange({ ...value, [it.key]: e.target.checked })}
                  />
                  <span>{it.label}</span>
                </label>
              ))}
              <span aria-hidden className="my-1 block h-px bg-[color:var(--te-line)]" />
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left font-medium hover:bg-[color:var(--te-chrome-sunken)]"
                onClick={() => onChange(toggleAllReferenceGuides(value))}
              >
                {anyOn ? "Ocultar todas" : "Mostrar todas"}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
