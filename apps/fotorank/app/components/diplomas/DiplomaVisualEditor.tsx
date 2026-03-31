"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Rnd } from "react-rnd";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  ImagePlus,
  Italic,
  Layers,
  Lock,
  QrCode,
  Square,
  Trash2,
  Type,
  Minus,
  Redo2,
  RotateCw,
  Sparkles,
  Underline,
  Undo2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  DEFAULT_DIPLOMA_FONT_ID,
  DIPLOMA_FONT_CATEGORY_LABELS,
  DIPLOMA_FONT_CATEGORY_ORDER,
  DIPLOMA_FONT_OPTIONS,
  diplomaFontCssStack,
  normalizeDiplomaFontId,
  type DiplomaFontCategoryId,
  type DiplomaFontId,
} from "../../lib/fotorank/diplomas/diplomaFonts";
import type {
  DiplomaLayoutBlock,
  DiplomaLayoutJson,
  DiplomaLayoutTextBlock,
} from "../../lib/fotorank/diplomas/layoutSchema";
import { DIPLOMA_VARIABLE_KEYS, newBlockId } from "../../lib/fotorank/diplomas/layoutSchema";
import { DiplomaLayoutPreview } from "./DiplomaLayoutPreview";
import type { DiplomaMergeVariables } from "../../lib/fotorank/diplomas/mergeFields";

const VAR_LABELS: Record<(typeof DIPLOMA_VARIABLE_KEYS)[number], string> = {
  recipientName: "Nombre del destinatario",
  entryTitle: "Título de la obra",
  contestTitle: "Título del concurso",
  organizerName: "Organizador",
  categoryName: "Categoría",
  prizeLabel: "Premio / reconocimiento",
  diplomaCode: "Código del diploma",
  issuedDate: "Fecha de emisión",
  verificationUrl: "URL de verificación",
};

function blockTypeLabel(b: DiplomaLayoutBlock): string {
  if (b.type === "text") return b.layerName?.trim() || "Texto";
  if (b.type === "qrcode") return b.layerName?.trim() || "Código QR";
  if (b.type === "image") return b.layerName?.trim() || "Imagen";
  if (b.type === "line") return b.layerName?.trim() || "Línea";
  return b.layerName?.trim() || "Forma";
}

function LayerTypeIcon({ block }: { block: DiplomaLayoutBlock }) {
  const cls = "size-3.5 shrink-0 text-gold/70";
  if (block.type === "text") return <Type className={cls} aria-hidden />;
  if (block.type === "qrcode") return <QrCode className={cls} aria-hidden />;
  if (block.type === "image") return <ImageIcon className={cls} aria-hidden />;
  if (block.type === "line") return <Minus className={cls} aria-hidden />;
  return <Square className={cls} aria-hidden />;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

const MAX_LAYOUT_HISTORY = 50;

function cloneLayoutJson(l: DiplomaLayoutJson): DiplomaLayoutJson {
  return JSON.parse(JSON.stringify(l)) as DiplomaLayoutJson;
}

function blockRotationDeg(block: DiplomaLayoutBlock): number {
  return block.rotation != null && Number.isFinite(block.rotation) ? block.rotation : 0;
}

function blockRotationStyle(deg: number): CSSProperties {
  if (deg === 0) return {};
  return {
    transform: `rotate(${deg}deg)`,
    transformOrigin: "center center",
    width: "100%",
    height: "100%",
  };
}

function normalizeHex(c: string): string {
  const t = c.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
  }
  return "#000000";
}

function isValidHexString(s: string): boolean {
  const t = s.trim();
  return /^#[0-9A-Fa-f]{3}$/i.test(t) || /^#[0-9A-Fa-f]{6}$/i.test(t);
}

const DIPLOMA_FONT_SIZE_OPTIONS: number[] = [
  ...Array.from({ length: 31 }, (_, i) => i + 6),
  40, 44, 48, 56, 64, 72,
];

function DiplomaFontFamilyPicker({
  value,
  onChange,
  compact = false,
}: {
  value: DiplomaFontId;
  onChange: (id: DiplomaFontId) => void;
  /** Una sola fila, sin etiqueta superior (barra de formato). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  const cur = DIPLOMA_FONT_OPTIONS.find((o) => o.id === value) ?? DIPLOMA_FONT_OPTIONS[0]!;
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return DIPLOMA_FONT_OPTIONS;
    return DIPLOMA_FONT_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint.toLowerCase().includes(q) ||
        DIPLOMA_FONT_CATEGORY_LABELS[o.category].toLowerCase().includes(q)
    );
  }, [q]);
  const byCategory = useMemo(() => {
    const m = new Map<DiplomaFontCategoryId, typeof DIPLOMA_FONT_OPTIONS>();
    for (const id of DIPLOMA_FONT_CATEGORY_ORDER) {
      m.set(id, []);
    }
    for (const o of filtered) {
      const arr = m.get(o.category);
      if (arr) arr.push(o);
    }
    return m;
  }, [filtered]);
  return (
    <div ref={containerRef} className={compact ? "relative min-w-0" : "relative space-y-1.5"}>
      {!compact ? <span className="text-xs font-medium text-fr-muted">Tipografía</span> : null}
      <button
        type="button"
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-fr-border bg-fr-bg px-2.5 text-fr-primary ${compact ? "h-9 py-1 text-sm" : "px-3 py-2"}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={cur.label}
      >
        <div className="min-w-0 flex-1 text-left">
          {!compact ? (
            <>
              <div className="font-sans text-[10px] font-medium text-fr-muted">{cur.label}</div>
              <div className="truncate text-base" style={{ fontFamily: diplomaFontCssStack(cur.id) }}>
                {cur.previewText}
              </div>
            </>
          ) : (
            <div className="truncate font-sans text-[13px] font-medium" style={{ fontFamily: diplomaFontCssStack(cur.id) }}>
              {cur.label}
            </div>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-fr-muted" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full z-[120] mt-1 w-[min(100vw-2rem,20rem)] min-w-[16rem] overflow-hidden rounded-xl border border-fr-border bg-fr-bg-elevated shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:w-[22rem] sm:min-w-[20rem]"
        >
          <div className="border-b border-fr-border/80 p-2">
            <label className="sr-only" htmlFor="diploma-font-search">
              Buscar tipografía
            </label>
            <input
              id="diploma-font-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o estilo…"
              className="w-full rounded-lg border border-fr-border bg-fr-bg px-2.5 py-1.5 text-xs text-fr-primary placeholder:text-fr-muted/70"
              autoFocus
            />
          </div>
          <div className="max-h-[min(50vh,320px)] overflow-y-auto overscroll-contain py-1" role="none">
            {DIPLOMA_FONT_CATEGORY_ORDER.map((cat) => {
              const items = byCategory.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-2 last:mb-0">
                  <p className="sticky top-0 z-[1] bg-fr-bg-elevated px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold/90">
                    {DIPLOMA_FONT_CATEGORY_LABELS[cat]}
                  </p>
                  <ul className="space-y-0.5 px-1" role="listbox">
                    {items.map((o) => (
                      <li key={o.id} role="option" aria-selected={o.id === value}>
                        <button
                          type="button"
                          className={`flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition ${
                            o.id === value ? "bg-gold/10 ring-1 ring-gold/35" : "hover:bg-fr-card"
                          }`}
                          onClick={() => {
                            onChange(o.id);
                            setOpen(false);
                          }}
                        >
                          <span className="font-sans text-[10px] font-medium text-fr-muted">{o.label}</span>
                          <span
                            className="text-[15px] leading-tight text-fr-primary"
                            style={{ fontFamily: diplomaFontCssStack(o.id) }}
                          >
                            {o.previewText}
                          </span>
                          <span className="font-sans text-[9px] text-fr-muted/70">{o.hint}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-fr-muted">No hay coincidencias.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextColorCompact({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = value.startsWith("#") && isValidHexString(value) ? normalizeHex(value) : "#fafafa";
  return (
    <div className="flex h-9 items-center gap-1.5 rounded-md border border-fr-border bg-fr-bg px-1.5">
      <span className="sr-only">Color del texto</span>
      <input
        type="color"
        className="h-7 w-8 shrink-0 cursor-pointer rounded border border-fr-border bg-fr-bg p-0.5"
        value={hex}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        title="Color"
        aria-label="Color del texto"
      />
      <input
        type="text"
        className="min-w-0 flex-1 bg-transparent font-mono text-[11px] tabular-nums text-fr-primary outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label="Hex color"
      />
    </div>
  );
}

function DiplomaTextFormatToolbar({
  block,
  onPatch,
  hideLabel = false,
}: {
  block: DiplomaLayoutTextBlock;
  onPatch: (p: Partial<DiplomaLayoutTextBlock>) => void;
  /** Oculta el título (p. ej. barra flotante con encabezado propio). */
  hideLabel?: boolean;
}) {
  const fmtBtn = (pressed: boolean) =>
    `flex size-9 shrink-0 items-center justify-center rounded-sm border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
      pressed ? "border-gold bg-gold/15 text-gold" : "border-transparent bg-transparent text-fr-muted hover:bg-fr-border/40 hover:text-fr-primary"
    }`;

  const align = block.textAlign ?? "left";

  return (
    <div className="space-y-2">
      {!hideLabel ? (
        <span className="text-xs font-medium text-fr-muted">Formato de texto</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fr-border bg-fr-bg-elevated p-2">
        <div className="min-w-0 flex-1 basis-[min(100%,11rem)]">
          <DiplomaFontFamilyPicker
            compact
            value={normalizeDiplomaFontId(block.fontFamily)}
            onChange={(fontFamily) => onPatch({ fontFamily })}
          />
        </div>
        <div className="flex h-9 items-center">
          <label htmlFor="diploma-font-pt" className="sr-only">
            Tamaño en puntos
          </label>
          <select
            id="diploma-font-pt"
            className="h-9 min-w-[5.5rem] rounded-md border border-fr-border bg-fr-bg px-2 text-sm text-fr-primary"
            value={Math.min(96, Math.max(6, block.fontSize))}
            onChange={(e) => onPatch({ fontSize: Number(e.target.value) })}
          >
            {DIPLOMA_FONT_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </select>
        </div>
        <div
          className="flex h-9 items-stretch overflow-hidden rounded-md border border-fr-border bg-fr-bg"
          role="group"
          aria-label="Estilo de carácter"
        >
          <button
            type="button"
            className={fmtBtn(block.fontWeight === "bold")}
            aria-pressed={block.fontWeight === "bold"}
            title="Negrita"
            onClick={() => onPatch({ fontWeight: block.fontWeight === "bold" ? "normal" : "bold" })}
          >
            <Bold className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            className={`${fmtBtn(block.fontStyle === "italic")} border-l border-fr-border`}
            aria-pressed={block.fontStyle === "italic"}
            title="Cursiva"
            onClick={() => onPatch({ fontStyle: block.fontStyle === "italic" ? "normal" : "italic" })}
          >
            <Italic className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            className={`${fmtBtn(block.textDecoration === "underline")} border-l border-fr-border`}
            aria-pressed={block.textDecoration === "underline"}
            title="Subrayado"
            onClick={() =>
              onPatch({
                textDecoration: block.textDecoration === "underline" ? "none" : "underline",
              })
            }
          >
            <Underline className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        <div
          className="flex h-9 items-stretch overflow-hidden rounded-md border border-fr-border bg-fr-bg"
          role="group"
          aria-label="Alineación"
        >
          <button
            type="button"
            className={fmtBtn(align === "left")}
            aria-pressed={align === "left"}
            title="Alinear a la izquierda"
            onClick={() => onPatch({ textAlign: "left" })}
          >
            <AlignLeft className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={`${fmtBtn(align === "center")} border-l border-fr-border`}
            aria-pressed={align === "center"}
            title="Centrar"
            onClick={() => onPatch({ textAlign: "center" })}
          >
            <AlignCenter className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={`${fmtBtn(align === "right")} border-l border-fr-border`}
            aria-pressed={align === "right"}
            title="Alinear a la derecha"
            onClick={() => onPatch({ textAlign: "right" })}
          >
            <AlignRight className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  allowTransparent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}) {
  const hexInputId = useId();
  const isTrans = allowTransparent && (value === "transparent" || value === "");
  const hex = !isTrans && value.startsWith("#") && isValidHexString(value) ? normalizeHex(value) : "#000000";

  const commitHexFromText = () => {
    if (isTrans) return;
    const t = value.trim();
    if (isValidHexString(t)) {
      const n = normalizeHex(t);
      if (n !== value) onChange(n);
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-fr-muted">{label}</span>
      {isTrans ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-fr-border bg-fr-bg px-3 py-2 font-mono text-sm text-fr-primary"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder="transparent"
            aria-label={`${label} (valor)`}
          />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-fr-muted">
            <input
              type="checkbox"
              checked={isTrans}
              onChange={(e) => onChange(e.target.checked ? "transparent" : "#000000")}
            />
            Sin relleno
          </label>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <input
            type="color"
            className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-fr-border bg-fr-bg p-0.5"
            value={hex}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            title="Elegir color"
            aria-label={`${label} — paleta`}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor={hexInputId} className="block text-[10px] font-medium text-fr-muted">
              Código hexadecimal (#RRGGBB)
            </label>
            <input
              id={hexInputId}
              type="text"
              className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 font-mono text-sm tabular-nums tracking-wide text-fr-primary placeholder:text-fr-muted/60"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={commitHexFromText}
              placeholder="#000000"
              spellCheck={false}
              autoComplete="off"
              aria-label={`${label} — código hexadecimal`}
            />
          </div>
          {allowTransparent ? (
            <label className="flex shrink-0 items-center gap-1.5 self-center pb-0.5 text-xs text-fr-muted">
              <input
                type="checkbox"
                checked={isTrans}
                onChange={(e) => onChange(e.target.checked ? "transparent" : "#000000")}
              />
              Sin relleno
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}

type Props = {
  layout: DiplomaLayoutJson;
  onChange: (next: DiplomaLayoutJson) => void;
  widthPt: number;
  heightPt: number;
  backgroundColor: string;
  backgroundImageUrl: string | null;
  onPageBackgroundColorChange: (hex: string) => void;
  onUploadBackground: (file: File) => Promise<void>;
  onRemoveBackgroundImage?: () => void;
  previewVariables: DiplomaMergeVariables | null;
  onLoadPreviewVariables: () => void;
  pending?: boolean;
  onUploadOverlay: (file: File) => Promise<void>;
  /** Oculta deshacer/rehacer en la barra del lienzo (p. ej. si están en la barra superior). */
  hideInlineUndoRedo?: boolean;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

export type DiplomaVisualEditorHandle = {
  undo: () => void;
  redo: () => void;
};

export const DiplomaVisualEditor = forwardRef<DiplomaVisualEditorHandle, Props>(function DiplomaVisualEditor(
  {
    layout,
    onChange,
    widthPt,
    heightPt,
    backgroundColor,
    backgroundImageUrl,
    onPageBackgroundColorChange,
    onUploadBackground,
    onRemoveBackgroundImage,
    previewVariables,
    onLoadPreviewVariables,
    pending,
    onUploadOverlay,
    hideInlineUndoRedo = false,
    onHistoryChange,
  },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const clipboardRef = useRef<DiplomaLayoutBlock | null>(null);
  const [scale, setScale] = useState(0.5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pastLayouts, setPastLayouts] = useState<DiplomaLayoutJson[]>([]);
  const [futureLayouts, setFutureLayouts] = useState<DiplomaLayoutJson[]>([]);
  const lastSyncedLayoutSigRef = useRef<string | null>(null);
  const applyingHistoryRef = useRef(false);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const pageCanvasRef = useRef<HTMLDivElement>(null);
  const textFormatFloatingRef = useRef<HTMLDivElement>(null);
  const rotationLiveRef = useRef<{
    undoSnapshot: DiplomaLayoutJson;
    lastAngle: number;
    blockId: string;
  } | null>(null);
  /** Arrastre en canvas: posición en vivo sin apilar undo hasta soltar (react-rnd en modo controlado). */
  const dragLiveRef = useRef<{ undoSnapshot: DiplomaLayoutJson; blockId: string } | null>(null);

  const handleRotationPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, block: DiplomaLayoutBlock) => {
      if (block.locked) return;
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const cx = block.x + block.width / 2;
      const cy = block.y + block.height / 2;
      const pageEl = pageCanvasRef.current;
      if (!pageEl) return;

      const toPt = (clientX: number, clientY: number) => {
        const r = pageEl.getBoundingClientRect();
        return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
      };

      const { x: px, y: py } = toPt(e.clientX, e.clientY);
      const lastAngle = Math.atan2(py - cy, px - cx);
      const undoSnapshot = cloneLayoutJson(layoutRef.current);
      rotationLiveRef.current = { undoSnapshot, lastAngle, blockId: block.id };

      const onMove = (ev: PointerEvent) => {
        const sess = rotationLiveRef.current;
        if (!sess || sess.blockId !== block.id) return;
        const { x, y } = toPt(ev.clientX, ev.clientY);
        const ang = Math.atan2(y - cy, x - cx);
        let d = ang - sess.lastAngle;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        sess.lastAngle = ang;

        const prev = layoutRef.current;
        const curBlock = prev.blocks.find((b) => b.id === block.id);
        if (!curBlock) return;
        const curRot = curBlock.rotation ?? 0;
        const newRot = curRot + (d * 180) / Math.PI;

        const next: DiplomaLayoutJson = {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === block.id ? { ...b, rotation: newRot } : b)),
        };
        onChange(next);
        lastSyncedLayoutSigRef.current = JSON.stringify(next);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        const sess = rotationLiveRef.current;
        rotationLiveRef.current = null;
        if (!sess) return;
        const now = layoutRef.current;
        if (JSON.stringify(sess.undoSnapshot) !== JSON.stringify(now)) {
          setPastLayouts((p) => {
            const np = [...p, sess.undoSnapshot];
            return np.length > MAX_LAYOUT_HISTORY ? np.slice(-MAX_LAYOUT_HISTORY) : np;
          });
          setFutureLayouts([]);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [scale, onChange]
  );

  const commitLayout = useCallback(
    (next: DiplomaLayoutJson) => {
      setPastLayouts((p) => {
        const np = [...p, cloneLayoutJson(layout)];
        return np.length > MAX_LAYOUT_HISTORY ? np.slice(-MAX_LAYOUT_HISTORY) : np;
      });
      setFutureLayouts([]);
      lastSyncedLayoutSigRef.current = JSON.stringify(next);
      onChange(next);
    },
    [layout, onChange]
  );

  const undoLayout = useCallback(() => {
    if (pastLayouts.length === 0) return;
    applyingHistoryRef.current = true;
    const prev = pastLayouts[pastLayouts.length - 1]!;
    setPastLayouts((p) => p.slice(0, -1));
    setFutureLayouts((f) => [cloneLayoutJson(layout), ...f]);
    lastSyncedLayoutSigRef.current = JSON.stringify(prev);
    onChange(prev);
  }, [pastLayouts, layout, onChange]);

  const redoLayout = useCallback(() => {
    if (futureLayouts.length === 0) return;
    applyingHistoryRef.current = true;
    const next = futureLayouts[0]!;
    setFutureLayouts((f) => f.slice(1));
    setPastLayouts((p) => {
      const np = [...p, cloneLayoutJson(layout)];
      return np.length > MAX_LAYOUT_HISTORY ? np.slice(-MAX_LAYOUT_HISTORY) : np;
    });
    lastSyncedLayoutSigRef.current = JSON.stringify(next);
    onChange(next);
  }, [futureLayouts, layout, onChange]);

  useEffect(() => {
    const sig = JSON.stringify(layout);
    if (lastSyncedLayoutSigRef.current === null) {
      lastSyncedLayoutSigRef.current = sig;
      return;
    }
    if (sig === lastSyncedLayoutSigRef.current) return;
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      lastSyncedLayoutSigRef.current = sig;
      return;
    }
    setPastLayouts([]);
    setFutureLayouts([]);
    lastSyncedLayoutSigRef.current = sig;
  }, [layout]);

  useEffect(() => {
    onHistoryChange?.({
      canUndo: pastLayouts.length > 0,
      canRedo: futureLayouts.length > 0,
    });
  }, [pastLayouts.length, futureLayouts.length, onHistoryChange]);

  useImperativeHandle(
    ref,
    () => ({
      undo: undoLayout,
      redo: redoLayout,
    }),
    [undoLayout, redoLayout]
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / widthPt));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthPt]);

  const selected = useMemo(
    () => layout.blocks.find((b) => b.id === selectedId) ?? null,
    [layout.blocks, selectedId]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<DiplomaLayoutBlock>) => {
      commitLayout({
        ...layout,
        blocks: layout.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as DiplomaLayoutBlock) : b)),
      });
    },
    [layout, commitLayout]
  );

  /** Mueve un bloque en tiempo real (sin `commitLayout`): sincroniza `layoutRef` para el siguiente evento de arrastre. */
  const applyBlockPositionLive = useCallback(
    (blockId: string, x: number, y: number) => {
      const prev = layoutRef.current;
      const next: DiplomaLayoutJson = {
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === blockId ? ({ ...b, x, y } as DiplomaLayoutBlock) : b
        ),
      };
      layoutRef.current = next;
      onChange(next);
      lastSyncedLayoutSigRef.current = JSON.stringify(next);
    },
    [onChange]
  );

  const removeBlock = useCallback(
    (id: string) => {
      commitLayout({ ...layout, blocks: layout.blocks.filter((b) => b.id !== id) });
      if (selectedId === id) setSelectedId(null);
    },
    [layout, commitLayout, selectedId]
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const b = layout.blocks.find((x) => x.id === id);
      if (!b) return;
      const nid = newBlockId();
      const clone = JSON.parse(JSON.stringify(b)) as DiplomaLayoutBlock;
      clone.id = nid;
      clone.x = Math.min(b.x + 24, widthPt - 80);
      clone.y = b.y + 24;
      if ("layerName" in clone && clone.layerName) clone.layerName = `${clone.layerName} (copia)`;
      commitLayout({ ...layout, blocks: [...layout.blocks, clone] });
      setSelectedId(nid);
    },
    [layout, commitLayout, widthPt]
  );

  /** Lista visual: arriba = delante. `blocks` en orden de dibujo (abajo → arriba). */
  const moveBlockRelativeToRow = useCallback(
    (dragId: string, targetId: string) => {
      if (dragId === targetId) return;
      const topFirst = [...layout.blocks].reverse();
      const from = topFirst.findIndex((b) => b.id === dragId);
      const to = topFirst.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return;
      const next = [...topFirst];
      const [item] = next.splice(from, 1);
      if (!item) return;
      next.splice(to, 0, item);
      commitLayout({ ...layout, blocks: [...next].reverse() });
    },
    [layout, commitLayout]
  );

  const moveBlockToBack = useCallback(
    (dragId: string) => {
      const topFirst = [...layout.blocks].reverse();
      const from = topFirst.findIndex((b) => b.id === dragId);
      if (from < 0) return;
      const next = [...topFirst];
      const [item] = next.splice(from, 1);
      if (!item) return;
      next.push(item);
      commitLayout({ ...layout, blocks: [...next].reverse() });
    },
    [layout, commitLayout]
  );

  const bringBlockForward = useCallback(
    (id: string) => {
      const idx = layout.blocks.findIndex((b) => b.id === id);
      if (idx < 0 || idx >= layout.blocks.length - 1) return;
      const blocks = [...layout.blocks];
      const a = blocks[idx];
      const b = blocks[idx + 1];
      if (!a || !b) return;
      blocks[idx] = b;
      blocks[idx + 1] = a;
      commitLayout({ ...layout, blocks });
    },
    [layout, commitLayout]
  );

  const sendBlockBackward = useCallback(
    (id: string) => {
      const idx = layout.blocks.findIndex((b) => b.id === id);
      if (idx <= 0) return;
      const blocks = [...layout.blocks];
      const a = blocks[idx];
      const b = blocks[idx - 1];
      if (!a || !b) return;
      blocks[idx] = b;
      blocks[idx - 1] = a;
      commitLayout({ ...layout, blocks });
    },
    [layout, commitLayout]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") e.preventDefault();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoLayout();
        else undoLayout();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoLayout();
        return;
      }
      if (mod && e.key.toLowerCase() === "c" && selectedId) {
        const b = layout.blocks.find((x) => x.id === selectedId);
        if (b) {
          clipboardRef.current = JSON.parse(JSON.stringify(b)) as DiplomaLayoutBlock;
          e.preventDefault();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && clipboardRef.current) {
        e.preventDefault();
        const clone = JSON.parse(JSON.stringify(clipboardRef.current)) as DiplomaLayoutBlock;
        clone.id = newBlockId();
        clone.x = Math.min(clone.x + 16, widthPt - 40);
        clone.y = clone.y + 16;
        commitLayout({ ...layout, blocks: [...layout.blocks, clone] });
        setSelectedId(clone.id);
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicateBlock(selectedId);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeBlock(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, commitLayout, selectedId, widthPt, duplicateBlock, removeBlock, undoLayout, redoLayout]);

  const addText = () => {
    const b: DiplomaLayoutTextBlock = {
      id: newBlockId(),
      type: "text",
      x: 72,
      y: 120,
      width: Math.min(480, widthPt - 144),
      height: 40,
      fontSize: 18,
      fontFamily: DEFAULT_DIPLOMA_FONT_ID,
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#fafafa",
      textAlign: "center",
      content: "{{recipientName}}",
      layerName: "Texto",
    };
    commitLayout({ ...layout, blocks: [...layout.blocks, b] });
    setSelectedId(b.id);
  };

  const addQr = () => {
    const b: DiplomaLayoutBlock = {
      id: newBlockId(),
      type: "qrcode",
      x: widthPt - 120,
      y: heightPt - 120,
      width: 96,
      height: 96,
      layerName: "QR",
    };
    commitLayout({ ...layout, blocks: [...layout.blocks, b] });
    setSelectedId(b.id);
  };

  const addLine = () => {
    const b: DiplomaLayoutBlock = {
      id: newBlockId(),
      type: "line",
      x: 72,
      y: heightPt / 2,
      width: Math.min(400, widthPt - 144),
      height: 3,
      strokeColor: "#d4af37",
      strokeWidth: 2,
      layerName: "Línea",
    };
    commitLayout({ ...layout, blocks: [...layout.blocks, b] });
    setSelectedId(b.id);
  };

  const addRect = () => {
    const b: DiplomaLayoutBlock = {
      id: newBlockId(),
      type: "rect",
      x: 72,
      y: 200,
      width: 200,
      height: 120,
      fillColor: "transparent",
      strokeColor: "#d4af37",
      strokeWidth: 1,
      layerName: "Marco",
    };
    commitLayout({ ...layout, blocks: [...layout.blocks, b] });
    setSelectedId(b.id);
  };

  const layersReversed = useMemo(() => [...layout.blocks].reverse(), [layout.blocks]);

  useEffect(() => {
    if (selectedId && !layout.blocks.some((b) => b.id === selectedId)) setSelectedId(null);
  }, [layout.blocks, selectedId]);

  const visibleBlocksForCanvas = useMemo(() => layout.blocks.filter((b) => !b.hidden), [layout.blocks]);

  const toolBtn =
    "flex size-11 shrink-0 items-center justify-center rounded-lg border border-fr-border bg-fr-bg-elevated text-fr-muted transition hover:border-gold/50 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-40";

  return (
    <div className="flex min-h-[min(72vh,820px)] flex-col gap-0">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(280px,400px)] lg:gap-0 lg:divide-x lg:divide-fr-border">
        {/* Panel de edición (derecha en escritorio; debajo del lienzo en móvil) */}
        <aside className="order-2 flex min-h-[280px] flex-col gap-5 overflow-y-auto lg:max-h-[min(88vh,920px)] lg:min-h-0 lg:pl-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-fr-muted">Página</p>
            <p className="text-[11px] leading-snug text-fr-muted">
              Formato horizontal fijo {Math.round(widthPt)}×{Math.round(heightPt)} pt
            </p>
            <ColorField label="Color de fondo" value={backgroundColor} onChange={onPageBackgroundColorChange} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                ref={bgFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={pending}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await onUploadBackground(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className={toolBtn}
                title="Imagen de fondo"
                aria-label="Añadir o cambiar imagen de fondo"
                disabled={pending}
                onClick={() => bgFileRef.current?.click()}
              >
                <ImagePlus className="size-5" strokeWidth={1.75} />
              </button>
              {backgroundImageUrl && onRemoveBackgroundImage ? (
                <button
                  type="button"
                  className="text-xs text-fr-muted underline hover:text-gold"
                  onClick={onRemoveBackgroundImage}
                >
                  Quitar fondo
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-fr-muted">Añadir al diseño</p>
            <input
              ref={overlayFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await onUploadOverlay(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button type="button" className={toolBtn} title="Texto" aria-label="Añadir texto" disabled={pending} onClick={addText}>
                <Type className="size-5" strokeWidth={1.75} />
              </button>
              <button type="button" className={toolBtn} title="Código QR" aria-label="Añadir QR" disabled={pending} onClick={addQr}>
                <QrCode className="size-5" strokeWidth={1.75} />
              </button>
              <button type="button" className={toolBtn} title="Línea" aria-label="Añadir línea" disabled={pending} onClick={addLine}>
                <Minus className="size-5" strokeWidth={1.75} />
              </button>
              <button type="button" className={toolBtn} title="Marco" aria-label="Añadir marco" disabled={pending} onClick={addRect}>
                <Square className="size-5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className={toolBtn}
                title="Logo o firma"
                aria-label="Añadir imagen (logo, firma)"
                disabled={pending}
                onClick={() => overlayFileRef.current?.click()}
              >
                <ImageIcon className="size-5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-shrink-0 flex-col gap-2 border-t border-fr-border pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-fr-primary">
              <Layers className="size-4 text-gold" aria-hidden />
              Capas
            </div>
            <p className="text-[11px] text-fr-muted">Arrastrá para reordenar. El ojo controla la visibilidad.</p>
            <ul className="max-h-[min(36vh,320px)] min-h-0 space-y-0 overflow-y-auto rounded-lg border border-fr-border bg-fr-bg">
              {layout.blocks.length === 0 ? (
                <li className="px-3 py-10 text-center text-sm text-fr-muted">Sin capas todavía.</li>
              ) : (
                layersReversed.map((b) => (
                  <li
                    key={b.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(b.id);
                      e.dataTransfer.setData("text/plain", b.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromId = e.dataTransfer.getData("text/plain");
                      if (fromId) moveBlockRelativeToRow(fromId, b.id);
                      setDraggingId(null);
                    }}
                    className={`flex items-center gap-1 border-b border-fr-border/80 last:border-b-0 ${
                      draggingId === b.id ? "opacity-50" : ""
                    }`}
                  >
                    <span className="cursor-grab px-1 text-fr-muted active:cursor-grabbing" title="Arrastrar">
                      <GripVertical className="size-4" aria-hidden />
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1.5 text-fr-muted hover:bg-fr-bg-elevated hover:text-gold"
                      title={b.hidden ? "Mostrar capa" : "Ocultar capa"}
                      aria-label={b.hidden ? "Mostrar capa" : "Ocultar capa"}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBlock(b.id, { hidden: !b.hidden });
                      }}
                    >
                      {b.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <LayerTypeIcon block={b} />
                    <button
                      type="button"
                      onClick={() => setSelectedId(b.id)}
                      className={`min-w-0 flex-1 truncate py-2.5 pr-2 text-left text-sm transition ${
                        selectedId === b.id ? "bg-fr-card-hover font-medium text-fr-primary" : "text-fr-muted hover:bg-fr-bg-elevated/80"
                      }`}
                    >
                      {blockTypeLabel(b)}
                    </button>
                    {b.locked ? <Lock className="size-3.5 shrink-0 text-gold" aria-hidden /> : <span className="w-3.5 shrink-0" />}
                  </li>
                ))
              )}
              {layout.blocks.length > 0 ? (
                <li
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData("text/plain");
                    if (fromId) moveBlockToBack(fromId);
                    setDraggingId(null);
                  }}
                  className="border-t border-dashed border-fr-border px-3 py-2 text-center text-[10px] text-fr-muted"
                >
                  Soltar aquí para llevar al fondo
                </li>
              ) : null}
            </ul>
          </div>

          {/* Propiedades */}
          <div className="flex flex-col gap-3 border-t border-fr-border pt-4">
            <div className="text-sm font-semibold text-fr-primary">Propiedades</div>
            {!selected ? (
              <p className="text-sm leading-relaxed text-fr-muted">Seleccioná un elemento en el lienzo o en la lista de capas.</p>
            ) : (
              <div className="space-y-5 pr-1">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-fr-muted">Nombre de capa</span>
                  <input
                    className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm text-fr-primary"
                    value={selected.layerName ?? ""}
                    onChange={(e) => updateBlock(selected.id, { layerName: e.target.value || undefined })}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-fr-border bg-fr-bg-elevated px-2.5 py-2 text-xs text-fr-muted hover:border-gold/40"
                    onClick={() => updateBlock(selected.id, { locked: !selected.locked })}
                  >
                    <Lock className="size-3.5" />
                    {selected.locked ? "Desbloquear" : "Bloquear"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-fr-border bg-fr-bg-elevated px-2.5 py-2 text-xs text-fr-muted hover:border-gold/40"
                    onClick={() => duplicateBlock(selected.id)}
                  >
                    <Copy className="size-3.5" />
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    onClick={() => removeBlock(selected.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </button>
                </div>

                <div>
                  <span className="text-xs font-medium text-fr-muted">Opacidad</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    className="mt-2 w-full accent-gold"
                    value={selected.opacity ?? 1}
                    onChange={(e) => updateBlock(selected.id, { opacity: Number(e.target.value) })}
                  />
                </div>

                <p className="text-[11px] leading-relaxed text-fr-muted">
                  Rotación: arrastrá el asa circular en la esquina inferior derecha del elemento en el lienzo.
                </p>

                {selected.type === "text" ? (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-fr-muted">Contenido</span>
                      <textarea
                        rows={5}
                        className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 font-sans text-sm text-fr-primary"
                        value={selected.content}
                        onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                      />
                    </label>
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-fr-muted">Variables</span>
                      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                        {DIPLOMA_VARIABLE_KEYS.map((k) => (
                          <button
                            key={k}
                            type="button"
                            className="rounded border border-fr-border bg-fr-bg-elevated px-2 py-1 text-[10px] text-fr-muted hover:border-gold hover:text-gold"
                            onClick={() =>
                              updateBlock(selected.id, {
                                content: `${(selected as DiplomaLayoutTextBlock).content}{{${k}}}`,
                              })
                            }
                          >
                            {VAR_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-[11px] leading-relaxed text-fr-muted">
                      {previewMode ? (
                        <>
                          Desactivá <span className="font-medium text-gold">Vista previa</span> para usar la barra
                          flotante de tipografía sobre el lienzo.
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-gold">Fuente, tamaño y color</span> también en el panel
                          flotante sobre el diploma; aquí el texto completo y variables.
                        </>
                      )}
                    </p>
                  </>
                ) : null}

                {selected.type === "line" ? (
                  <>
                    <ColorField label="Color" value={selected.strokeColor} onChange={(v) => updateBlock(selected.id, { strokeColor: v })} />
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-fr-muted">Grosor</span>
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm"
                        value={selected.strokeWidth}
                        onChange={(e) => updateBlock(selected.id, { strokeWidth: Number(e.target.value) })}
                      />
                    </label>
                  </>
                ) : null}

                {selected.type === "rect" ? (
                  <>
                    <ColorField
                      label="Relleno"
                      value={selected.fillColor ?? "transparent"}
                      onChange={(v) => updateBlock(selected.id, { fillColor: v })}
                      allowTransparent
                    />
                    <ColorField
                      label="Borde"
                      value={selected.strokeColor ?? "#d4af37"}
                      onChange={(v) => updateBlock(selected.id, { strokeColor: v })}
                    />
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-fr-muted">Grosor del borde</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm"
                        value={selected.strokeWidth ?? 0}
                        onChange={(e) => updateBlock(selected.id, { strokeWidth: Number(e.target.value) })}
                      />
                    </label>
                  </>
                ) : null}

                {selected.type === "image" ? (
                  <p className="text-xs leading-relaxed text-fr-muted">
                    Usá el botón de imagen en «Añadir al diseño» para subir otra firma o logo.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </aside>

        {/* Lienzo (izquierda en escritorio; arriba en móvil) */}
        <div className="order-1 flex min-h-[320px] flex-col gap-3 px-1 lg:min-h-0 lg:flex-1 lg:pr-4 lg:pl-1">
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-fr-border/60 pb-3">
            {!hideInlineUndoRedo ? (
              <>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-fr-border bg-fr-bg-elevated text-fr-muted transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
                  title="Deshacer (⌘Z / Ctrl+Z)"
                  aria-label="Deshacer"
                  disabled={pending || pastLayouts.length === 0}
                  onClick={undoLayout}
                >
                  <Undo2 className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-fr-border bg-fr-bg-elevated text-fr-muted transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
                  title="Rehacer (⌘⇧Z / Ctrl+Y)"
                  aria-label="Rehacer"
                  disabled={pending || futureLayouts.length === 0}
                  onClick={redoLayout}
                >
                  <Redo2 className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                previewMode ? "border-gold/60 bg-gold/10 text-gold" : "border-fr-border bg-fr-bg-elevated text-fr-muted hover:border-gold/40"
              }`}
              onClick={() => {
                if (!previewMode && !previewVariables) onLoadPreviewVariables();
                setPreviewMode(!previewMode);
              }}
              disabled={pending}
            >
              <Sparkles className="size-4" aria-hidden />
              {previewMode ? "Editar diseño" : "Vista previa"}
            </button>
            <span className="hidden text-[11px] text-fr-muted sm:inline">Horizontal · datos de ejemplo al activar vista previa</span>
          </div>

          <div className="relative flex min-h-[320px] flex-1 flex-col lg:min-h-0">
            <div
              ref={wrapRef}
              className="w-full max-w-full flex-1 rounded-xl border border-white/[0.06] bg-[repeating-conic-gradient(#0b0c10_0%_25%,#08090c_0%_50%)_50%/16px_16px] p-3 sm:p-5"
            >
            {previewMode && previewVariables ? (
              <DiplomaLayoutPreview
                layout={layout}
                variables={previewVariables}
                widthPt={widthPt}
                heightPt={heightPt}
                backgroundColor={backgroundColor}
                backgroundImageUrl={backgroundImageUrl}
              />
            ) : (
              <div
                style={{
                  width: widthPt * scale,
                  height: heightPt * scale,
                  position: "relative",
                }}
              >
                <div
                  ref={pageCanvasRef}
                  className="absolute inset-0 overflow-visible rounded-lg ring-1 ring-white/10"
                  style={{
                    width: widthPt,
                    height: heightPt,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    backgroundColor,
                    backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setSelectedId(null);
                  }}
                >
                  {visibleBlocksForCanvas.map((block) => {
                    const isSel = selectedId === block.id;
                    const locked = block.locked === true;
                    const op = block.opacity != null && Number.isFinite(block.opacity) ? block.opacity : 1;

                    const commonRnd = {
                      scale,
                      position: { x: block.x * scale, y: block.y * scale },
                      size: { width: block.width * scale, height: block.height * scale },
                      disableDragging: locked,
                      enableResizing: !locked,
                      resizeHandleStyles: {
                        bottomRight: { width: 12, height: 12, bottom: -4, right: -4 },
                      },
                      onDragStart: () => {
                        dragLiveRef.current = {
                          undoSnapshot: cloneLayoutJson(layoutRef.current),
                          blockId: block.id,
                        };
                        setSelectedId(block.id);
                      },
                      onDrag: (_e: unknown, d: { x: number; y: number }) => {
                        applyBlockPositionLive(block.id, d.x / scale, d.y / scale);
                      },
                      onDragStop: (_e: unknown, d: { x: number; y: number }) => {
                        applyBlockPositionLive(block.id, d.x / scale, d.y / scale);
                        const sess = dragLiveRef.current;
                        dragLiveRef.current = null;
                        if (
                          sess?.blockId === block.id &&
                          JSON.stringify(sess.undoSnapshot) !== JSON.stringify(layoutRef.current)
                        ) {
                          setPastLayouts((p) => {
                            const np = [...p, sess.undoSnapshot];
                            return np.length > MAX_LAYOUT_HISTORY ? np.slice(-MAX_LAYOUT_HISTORY) : np;
                          });
                          setFutureLayouts([]);
                        }
                      },
                      onResizeStop: (
                        _e: unknown,
                        _dir: unknown,
                        ref: HTMLElement,
                        _delta: unknown,
                        pos: { x: number; y: number }
                      ) => {
                        updateBlock(block.id, {
                          x: pos.x / scale,
                          y: pos.y / scale,
                          width: ref.offsetWidth / scale,
                          height: ref.offsetHeight / scale,
                        } as Partial<DiplomaLayoutBlock>);
                      },
                      minWidth: 20,
                      minHeight: 12,
                      style: { zIndex: isSel ? 20 : 2, overflow: "visible" },
                    };

                    if (block.type === "qrcode") {
                      const rot = blockRotationDeg(block);
                      return (
                        <Rnd
                          key={block.id}
                          className="!overflow-visible"
                          {...commonRnd}
                          lockAspectRatio
                          minWidth={32}
                          minHeight={32}
                          onResizeStop={(
                            _e: unknown,
                            _dir: unknown,
                            ref: HTMLElement,
                            _delta: unknown,
                            pos: { x: number; y: number }
                          ) => {
                            const w = ref.offsetWidth / scale;
                            const h = ref.offsetHeight / scale;
                            const s = Math.min(w, h);
                            updateBlock(block.id, {
                              x: pos.x / scale,
                              y: pos.y / scale,
                              width: s,
                              height: s,
                            } as Partial<DiplomaLayoutBlock>);
                          }}
                          bounds="parent"
                        >
                          <div className="relative h-full w-full">
                            <div
                              role="presentation"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(block.id);
                              }}
                              className={`flex aspect-square h-full w-full cursor-grab touch-none select-none items-center justify-center border-2 border-dashed bg-white/90 text-[10px] text-black active:cursor-grabbing ${
                                isSel ? "border-gold" : "border-white/40"
                              }`}
                              style={{ ...blockRotationStyle(rot), opacity: op, touchAction: "none" }}
                            >
                              QR
                            </div>
                            {isSel && !locked ? (
                              <button
                                type="button"
                                className="absolute bottom-1 right-1 z-[30] flex size-7 cursor-grab touch-none items-center justify-center rounded-full border-2 border-gold bg-fr-bg text-gold shadow-md hover:bg-gold/15 active:cursor-grabbing"
                                aria-label="Rotar"
                                title="Rotar"
                                onPointerDown={(e) => handleRotationPointerDown(e, block)}
                              >
                                <RotateCw className="pointer-events-none size-3.5" strokeWidth={2} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </Rnd>
                      );
                    }

                    if (block.type === "image") {
                      const rot = blockRotationDeg(block);
                      return (
                        <Rnd
                          key={block.id}
                          className="!overflow-visible"
                          {...commonRnd}
                          bounds="parent"
                          lockAspectRatio
                          onResizeStop={(
                            _e: unknown,
                            _dir: unknown,
                            ref: HTMLElement,
                            _delta: unknown,
                            pos: { x: number; y: number }
                          ) => {
                            const w = ref.offsetWidth / scale;
                            const h = ref.offsetHeight / scale;
                            updateBlock(block.id, {
                              x: pos.x / scale,
                              y: pos.y / scale,
                              width: w,
                              height: h,
                            } as Partial<DiplomaLayoutBlock>);
                          }}
                        >
                          <div className="relative h-full w-full">
                            <div
                              role="presentation"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(block.id);
                              }}
                              className={`relative h-full w-full cursor-grab touch-none select-none overflow-hidden border-2 active:cursor-grabbing ${isSel ? "border-gold" : "border-white/30"}`}
                              style={{ ...blockRotationStyle(rot), opacity: op, touchAction: "none" }}
                            >
                              {/* draggable={false} evita el “fantasma” nativo del navegador al arrastrar; el movimiento lo hace react-rnd */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={block.imageUrl}
                                alt=""
                                draggable={false}
                                className="pointer-events-none h-full w-full select-none object-contain [-webkit-user-drag:none]"
                              />
                            </div>
                            {isSel && !locked ? (
                              <button
                                type="button"
                                className="absolute bottom-1 right-1 z-[30] flex size-7 cursor-grab touch-none items-center justify-center rounded-full border-2 border-gold bg-fr-bg text-gold shadow-md hover:bg-gold/15 active:cursor-grabbing"
                                aria-label="Rotar"
                                title="Rotar"
                                onPointerDown={(e) => handleRotationPointerDown(e, block)}
                              >
                                <RotateCw className="pointer-events-none size-3.5" strokeWidth={2} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </Rnd>
                      );
                    }

                    if (block.type === "line") {
                      const rot = blockRotationDeg(block);
                      return (
                        <Rnd key={block.id} className="!overflow-visible" {...commonRnd} bounds="parent">
                          <div className="relative h-full w-full">
                            <div
                              role="presentation"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(block.id);
                              }}
                              className={`h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${isSel ? "ring-2 ring-gold" : ""}`}
                              style={{
                                ...blockRotationStyle(rot),
                                backgroundColor: block.strokeColor,
                                opacity: op,
                                touchAction: "none",
                              }}
                            />
                            {isSel && !locked ? (
                              <button
                                type="button"
                                className="absolute bottom-1 right-1 z-[30] flex size-7 cursor-grab touch-none items-center justify-center rounded-full border-2 border-gold bg-fr-bg text-gold shadow-md hover:bg-gold/15 active:cursor-grabbing"
                                aria-label="Rotar"
                                title="Rotar"
                                onPointerDown={(e) => handleRotationPointerDown(e, block)}
                              >
                                <RotateCw className="pointer-events-none size-3.5" strokeWidth={2} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </Rnd>
                      );
                    }

                    if (block.type === "rect") {
                      const rot = blockRotationDeg(block);
                      return (
                        <Rnd key={block.id} className="!overflow-visible" {...commonRnd} bounds="parent">
                          <div className="relative h-full w-full">
                            <div
                              role="presentation"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(block.id);
                              }}
                              className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
                              style={{
                                ...blockRotationStyle(rot),
                                opacity: op,
                                touchAction: "none",
                                backgroundColor: block.fillColor === "transparent" ? "transparent" : block.fillColor ?? "transparent",
                                border:
                                  block.strokeColor && block.strokeWidth
                                    ? `${block.strokeWidth}px solid ${block.strokeColor}`
                                    : undefined,
                              }}
                            />
                            {isSel && !locked ? (
                              <button
                                type="button"
                                className="absolute bottom-1 right-1 z-[30] flex size-7 cursor-grab touch-none items-center justify-center rounded-full border-2 border-gold bg-fr-bg text-gold shadow-md hover:bg-gold/15 active:cursor-grabbing"
                                aria-label="Rotar"
                                title="Rotar"
                                onPointerDown={(e) => handleRotationPointerDown(e, block)}
                              >
                                <RotateCw className="pointer-events-none size-3.5" strokeWidth={2} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </Rnd>
                      );
                    }

                    const textBlock = block as DiplomaLayoutTextBlock;
                    const rot = blockRotationDeg(block);
                    return (
                      <Rnd key={block.id} className="!overflow-visible" {...commonRnd} bounds="parent">
                        <div className="relative h-full w-full">
                          <div
                            role="presentation"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(block.id);
                            }}
                            className={`h-full w-full cursor-grab touch-none select-none overflow-hidden border px-1 active:cursor-grabbing ${isSel ? "border-gold" : "border-white/20"}`}
                            style={{
                              ...blockRotationStyle(rot),
                              opacity: op,
                              touchAction: "none",
                              color: textBlock.color,
                              fontSize: textBlock.fontSize,
                              fontFamily: diplomaFontCssStack(textBlock.fontFamily),
                              fontWeight: textBlock.fontWeight === "bold" ? 700 : 400,
                              fontStyle: textBlock.fontStyle === "italic" ? "italic" : "normal",
                              textDecoration: textBlock.textDecoration === "underline" ? "underline" : "none",
                              textUnderlineOffset: textBlock.textDecoration === "underline" ? "0.12em" : undefined,
                              textAlign: textBlock.textAlign ?? "left",
                            }}
                          >
                            <span className="line-clamp-6 whitespace-pre-wrap break-words">{textBlock.content || "Texto"}</span>
                          </div>
                          {isSel && !locked ? (
                            <button
                              type="button"
                              className="absolute bottom-1 right-1 z-[30] flex size-7 cursor-grab touch-none items-center justify-center rounded-full border-2 border-gold bg-fr-bg text-gold shadow-md hover:bg-gold/15 active:cursor-grabbing"
                              aria-label="Rotar"
                              title="Rotar"
                              onPointerDown={(e) => handleRotationPointerDown(e, block)}
                            >
                              <RotateCw className="pointer-events-none size-3.5" strokeWidth={2} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </Rnd>
                    );
                  })}
                </div>
              </div>
            )}
            </div>

            {selected?.type === "text" && !previewMode ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-2 z-40 flex justify-center px-2 sm:bottom-3"
                role="presentation"
              >
                <div
                  ref={textFormatFloatingRef}
                  className="pointer-events-auto w-full max-w-[min(100%,26rem)] rounded-xl border border-gold/40 bg-fr-bg-elevated/98 p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-md"
                  role="toolbar"
                  aria-label="Ajustes rápidos del texto"
                >
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-gold/15 pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-gold/35 bg-fr-bg text-gold">
                        <Type className="size-3.5" strokeWidth={2} aria-hidden />
                      </span>
                      <p className="truncate text-[11px] font-medium text-fr-primary">
                        {(selected as DiplomaLayoutTextBlock).layerName?.trim() || "Texto"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md border border-transparent text-fr-muted hover:bg-fr-border/50 hover:text-fr-primary"
                        title="Traer adelante"
                        aria-label="Traer capa al frente"
                        onClick={() => bringBlockForward(selected.id)}
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md border border-transparent text-fr-muted hover:bg-fr-border/50 hover:text-fr-primary"
                        title="Enviar atrás"
                        aria-label="Enviar capa atrás"
                        onClick={() => sendBlockBackward(selected.id)}
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md border border-transparent text-fr-muted hover:bg-fr-border/50 hover:text-fr-primary"
                        title="Duplicar"
                        aria-label="Duplicar bloque"
                        onClick={() => duplicateBlock(selected.id)}
                      >
                        <Copy className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md border border-transparent text-red-300/90 hover:bg-red-500/10"
                        title="Eliminar"
                        aria-label="Eliminar bloque"
                        onClick={() => removeBlock(selected.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <DiplomaTextFormatToolbar
                    hideLabel
                    block={selected as DiplomaLayoutTextBlock}
                    onPatch={(patch) => updateBlock(selected.id, patch as Partial<DiplomaLayoutBlock>)}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-fr-border/60 pt-2">
                    <TextColorCompact
                      value={(selected as DiplomaLayoutTextBlock).color}
                      onChange={(v) => updateBlock(selected.id, { color: v })}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

DiplomaVisualEditor.displayName = "DiplomaVisualEditor";
