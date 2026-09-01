"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPrimarySelectedBlockId, updateBlock, type TemplateV2EditorDispatch, type TemplateV2EditorState } from "@repo/template-editor-core";
import {
  EDITOR_FONT_CATEGORY_LABELS,
  EDITOR_FONT_CATALOG,
  findEditorFontEntry,
  type EditorFontCategory,
  type EditorFontEntry,
} from "@repo/template-editor-core";
import { TemplateBlockSafeAreaAlignmentStrip } from "./TemplateBlockSafeAreaAlignmentStrip";
import { asObject, formatFontFamilyCss, normalizeBlockConfig, type TemplateV2Block } from "@repo/template-editor-core";
import { cn } from "./primitives/cn";

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  /**
   * Reemplaza el contenedor propio (dirección, cromo y espaciado). La barra de propiedades la
   * monta en una sola línea sin borde ni fondo; suelta, se apila y crece en alto.
   */
  shellClassName?: string;
};

function mergeConfigJson(block: TemplateV2Block, patch: Record<string, unknown>) {
  const base = asObject(normalizeBlockConfig(block.type, block.configJson));
  return { ...base, ...patch };
}

const toolSep = <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-[color:var(--te-line)] sm:inline" aria-hidden />;

function IconBold({ className }: { className?: string }) {
  return (
    <span className={cn("text-[12px] font-bold leading-none", className)} aria-hidden>
      B
    </span>
  );
}

function IconItalic({ className }: { className?: string }) {
  return (
    <span className={cn("text-[12px] italic leading-none", className)} aria-hidden>
      I
    </span>
  );
}

function IconUnderline({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4v8a6 6 0 0 0 12 0V4" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconAlignLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="2" y="3" width="10" height="1.5" rx="0.5" />
      <rect x="2" y="6" width="6" height="1.5" rx="0.5" />
      <rect x="2" y="9" width="8" height="1.5" rx="0.5" />
      <rect x="2" y="12" width="5" height="1.5" rx="0.5" />
    </svg>
  );
}

function IconAlignCenter({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="2" y="3" width="12" height="1.5" rx="0.5" />
      <rect x="4" y="6" width="8" height="1.5" rx="0.5" />
      <rect x="3" y="9" width="10" height="1.5" rx="0.5" />
      <rect x="5" y="12" width="6" height="1.5" rx="0.5" />
    </svg>
  );
}

function IconAlignRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="4" y="3" width="10" height="1.5" rx="0.5" />
      <rect x="8" y="6" width="6" height="1.5" rx="0.5" />
      <rect x="6" y="9" width="8" height="1.5" rx="0.5" />
      <rect x="9" y="12" width="5" height="1.5" rx="0.5" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const fmtMiniBtn =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[color:var(--te-line)] bg-white text-[color:var(--te-ink)] shadow-sm hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-40";

/** Slider compacto para la barra de formato (accent = color de marca). */
const fmtRange =
  "h-1.5 w-[min(100%,7.5rem)] min-w-[5.5rem] max-w-[8.5rem] cursor-pointer accent-[color:var(--te-accent)] disabled:cursor-not-allowed disabled:opacity-40";

/** El ciclo del botón: normal → MAYÚSCULAS → minúsculas → Iniciales → normal. */
const SIGUIENTE_CONVERSION = {
  none: "uppercase",
  uppercase: "lowercase",
  lowercase: "capitalize",
  capitalize: "none",
} as const;

const ETIQUETA_CONVERSION = {
  none: "Sin conversión — tocá para pasar a MAYÚSCULAS",
  uppercase: "MAYÚSCULAS — tocá para pasar a minúsculas",
  lowercase: "minúsculas — tocá para pasar a Iniciales",
  capitalize: "Iniciales — tocá para volver al texto original",
} as const;

export function TemplateTextFormatToolbar({ state, dispatch, shellClassName }: Props) {
  const primaryId = getPrimarySelectedBlockId(state);
  const block = primaryId ? state.blocks.find((b) => b.id === primaryId) ?? null : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [fontOpen, setFontOpen] = useState(false);

  const patchConfig = useCallback(
    (patch: Record<string, unknown>) => {
      if (!block || (block.type !== "TEXT" && block.type !== "VARIABLE_TEXT")) return;
      dispatch(updateBlock(block.id, { configJson: mergeConfigJson(block, patch) }));
    },
    [block, dispatch]
  );

  useEffect(() => {
    if (!fontOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFontOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [fontOpen]);

  if (!block || (block.type !== "TEXT" && block.type !== "VARIABLE_TEXT")) {
    return null;
  }

  const selectedBlock: TemplateV2Block = block;
  const locked = selectedBlock.layout.locked ?? false;
  const cfg = normalizeBlockConfig(selectedBlock.type, selectedBlock.configJson) as Record<string, unknown>;
  const fontFamily = String(cfg.fontFamily ?? "Helvetica");
  const fontEntry = findEditorFontEntry(fontFamily);
  const fontLabel = fontEntry?.label ?? fontFamily;
  const fontSize = typeof cfg.fontSize === "number" ? cfg.fontSize : 20;
  const fontWeight = typeof cfg.fontWeight === "number" ? cfg.fontWeight : 400;
  const lineHeight = typeof cfg.lineHeight === "number" ? cfg.lineHeight : 1.2;
  const letterSpacing = typeof cfg.letterSpacing === "number" ? cfg.letterSpacing : 0;
  const textAlignRaw = String(cfg.textAlign ?? "CENTER").toUpperCase();
  const color = String(cfg.color ?? "#111111");
  const fontItalic = cfg.fontItalic === true;
  const underline = cfg.underline === true;
  const conversion =
    cfg.textTransform === "uppercase" ||
    cfg.textTransform === "lowercase" ||
    cfg.textTransform === "capitalize"
      ? (cfg.textTransform as "uppercase" | "lowercase" | "capitalize")
      : "none";
  const isBold = fontWeight >= 600;

  const byCategory = EDITOR_FONT_CATALOG.reduce<Record<string, EditorFontEntry[]>>((acc, f) => {
    const k = f.category;
    if (!acc[k]) acc[k] = [];
    acc[k].push(f);
    return acc;
  }, {});

  const categoryOrder: EditorFontCategory[] = ["Sans", "Serif", "Display", "Mono", "Script", "Handwriting"];

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex gap-1.5",
        shellClassName ??
          "flex-col border-t border-[color:var(--te-line)] bg-[color:var(--te-chrome-sunken)] px-2 py-1.5",
      )}
      role="toolbar"
      aria-label="Formato de texto"
    >
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-muted)]">
        <span className="font-semibold text-[color:var(--te-ink)]">Cómo editar:</span> un clic en el texto selecciona · doble clic
        para escribir · arrastrá el marco para mover ·{" "}
        <span className="whitespace-nowrap">
          esquinas redimensionan caja y tipografía; el tamaño en px es aquí abajo.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
      <div className="relative z-20">
        <button
          type="button"
          disabled={locked}
          onClick={() => setFontOpen((o) => !o)}
          className={cn(
            "flex h-8 max-w-[min(100%,220px)] min-w-[148px] items-center justify-between gap-1 rounded border border-[#babfc5] bg-white px-2.5 text-left text-[12px] text-[color:var(--te-ink)] shadow-sm",
            locked && "cursor-not-allowed opacity-50"
          )}
          style={{ fontFamily: formatFontFamilyCss(fontFamily) }}
          title="Fuente"
        >
          <span className="min-w-0 flex-1 truncate">{fontLabel}</span>
          <IconChevronDown className="shrink-0 opacity-70" />
        </button>
        {fontOpen && !locked ? (
          <div
            className="absolute left-0 top-full z-50 mt-1 max-h-[min(70vh,320px)] w-[min(100vw-2rem,280px)] overflow-y-auto rounded-md border border-[color:var(--te-line)] bg-white py-1 shadow-lg"
            role="listbox"
          >
            {categoryOrder.map((cat) => {
              const items = byCategory[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <p className="sticky top-0 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--te-ink-faint)]">
                    {EDITOR_FONT_CATEGORY_LABELS[cat]}
                  </p>
                  {items.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="option"
                      className={cn(
                        "flex w-full items-center px-2.5 py-2 text-left text-[13px] hover:bg-[color:var(--te-chrome-sunken)]",
                        f.family === fontFamily && "bg-[#e8f0fe]"
                      )}
                      style={{ fontFamily: formatFontFamilyCss(f.family) }}
                      onClick={() => {
                        patchConfig({ fontFamily: f.family });
                        setFontOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{f.label}</span>
                      <span className="ml-2 shrink-0 text-[10px] text-[color:var(--te-ink-faint)]">
                        {EDITOR_FONT_CATEGORY_LABELS[f.category]}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {toolSep}

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={fmtMiniBtn}
          disabled={locked || fontSize <= 8}
          title="Reducir tamaño"
          aria-label="Reducir tamaño"
          onClick={() => patchConfig({ fontSize: Math.max(8, fontSize - 1) })}
        >
          −
        </button>
        <input
          type="number"
          disabled={locked}
          className="h-7 w-11 rounded border border-[color:var(--te-line)] bg-white px-1 text-center text-[12px] text-[color:var(--te-ink)] shadow-sm"
          value={Math.round(fontSize)}
          min={8}
          max={400}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            patchConfig({ fontSize: Math.max(8, Math.min(400, Math.round(v))) });
          }}
          aria-label="Tamaño de fuente"
        />
        <button
          type="button"
          className={fmtMiniBtn}
          disabled={locked || fontSize >= 400}
          title="Aumentar tamaño"
          aria-label="Aumentar tamaño"
          onClick={() => patchConfig({ fontSize: Math.min(400, fontSize + 1) })}
        >
          +
        </button>
      </div>

      {toolSep}

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={cn(fmtMiniBtn, isBold && "border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)]")}
          disabled={locked}
          title="Negrita"
          aria-label="Negrita"
          aria-pressed={isBold}
          onClick={() => patchConfig({ fontWeight: isBold ? 400 : 700 })}
        >
          <IconBold className="block" />
        </button>
        <button
          type="button"
          className={cn(fmtMiniBtn, fontItalic && "border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)]")}
          disabled={locked}
          title="Cursiva"
          aria-label="Cursiva"
          aria-pressed={fontItalic}
          onClick={() => patchConfig({ fontItalic: !fontItalic })}
        >
          <IconItalic className="block" />
        </button>
        <button
          type="button"
          className={cn(fmtMiniBtn, underline && "border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)]")}
          disabled={locked}
          title="Subrayado"
          aria-label="Subrayado"
          aria-pressed={underline}
          onClick={() => patchConfig({ underline: !underline })}
        >
          <IconUnderline className="block" />
        </button>
        {/*
          Conmuta entre normal, MAYÚSCULAS, minúsculas e Iniciales. No cambia el texto guardado:
          es cómo se dibuja. Por eso funciona igual sobre un dato variable —un nombre que llega
          del padrón en minúsculas se imprime en mayúsculas sin tocar el padrón.
        */}
        <button
          type="button"
          className={cn(
            fmtMiniBtn,
            conversion !== "none" &&
              "border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)]",
          )}
          disabled={locked}
          title={ETIQUETA_CONVERSION[conversion]}
          aria-label={ETIQUETA_CONVERSION[conversion]}
          aria-pressed={conversion !== "none"}
          onClick={() => patchConfig({ textTransform: SIGUIENTE_CONVERSION[conversion] })}
        >
          <span className="block font-semibold leading-none">
            {conversion === "lowercase" ? "aa" : conversion === "capitalize" ? "Aa" : "AA"}
          </span>
        </button>
        <label
          className={cn(
            "inline-flex h-7 w-9 cursor-pointer items-center justify-center overflow-hidden rounded border border-[color:var(--te-line)] bg-white shadow-sm",
            locked && "pointer-events-none opacity-40"
          )}
          title="Color del texto"
        >
          <span className="sr-only">Color del texto</span>
          <input
            type="color"
            disabled={locked}
            value={color.length === 7 ? color : "#111111"}
            className="h-10 w-12 cursor-pointer border-0 bg-transparent p-0"
            onChange={(e) => patchConfig({ color: e.target.value })}
          />
        </label>
      </div>

      {toolSep}

      <div className="flex items-center gap-1.5">
        <span className="hidden shrink-0 text-[10px] font-medium leading-tight text-[color:var(--te-ink-faint)] sm:inline">
          En zona segura
        </span>
        <TemplateBlockSafeAreaAlignmentStrip state={state} dispatch={dispatch} />
      </div>

      {toolSep}

      <div className="flex items-center gap-0.5">
        {(
          [
            { al: "LEFT" as const, Icon: IconAlignLeft, title: "Alinear texto a la izquierda" },
            { al: "CENTER" as const, Icon: IconAlignCenter, title: "Centrar texto en la caja" },
            { al: "RIGHT" as const, Icon: IconAlignRight, title: "Alinear texto a la derecha" },
          ] as const
        ).map(({ al, Icon, title }) => (
          <button
            key={al}
            type="button"
            className={cn(fmtMiniBtn, textAlignRaw === al && "border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)]")}
            disabled={locked}
            title={title}
            aria-label={title}
            aria-pressed={textAlignRaw === al}
            onClick={() => patchConfig({ textAlign: al })}
          >
            <Icon className="block opacity-90" />
          </button>
        ))}
      </div>

      {toolSep}

      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
        <span className="shrink-0 text-[10px] font-medium leading-none text-[color:var(--te-ink-muted)] sm:w-[4.75rem]">
          Interlineado
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            type="range"
            min={0.6}
            max={3}
            step={0.01}
            disabled={locked}
            className={fmtRange}
            value={Math.min(3, Math.max(0.6, lineHeight))}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isFinite(v)) return;
              patchConfig({ lineHeight: Math.round(Math.max(0.6, Math.min(3, v)) * 100) / 100 });
            }}
            aria-label="Interlineado"
            title="Interlineado (altura de línea)"
          />
          <span className="w-9 shrink-0 tabular-nums text-right text-[10px] text-[color:var(--te-ink)]" aria-hidden>
            {lineHeight.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
        <span className="shrink-0 text-[10px] font-medium leading-none text-[color:var(--te-ink-muted)] sm:w-[4.75rem]">
          Espacio
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            type="range"
            min={-5}
            max={20}
            step={0.1}
            disabled={locked}
            className={fmtRange}
            value={Math.min(20, Math.max(-5, letterSpacing))}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isFinite(v)) return;
              patchConfig({ letterSpacing: Math.round(Math.max(-5, Math.min(20, v)) * 10) / 10 });
            }}
            aria-label="Espacio entre letras"
            title="Espacio entre letras (px)"
          />
          <span className="w-9 shrink-0 tabular-nums text-right text-[10px] text-[color:var(--te-ink)]" aria-hidden>
            {letterSpacing.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          </span>
        </div>
      </div>

      </div>
    </div>
  );
}
