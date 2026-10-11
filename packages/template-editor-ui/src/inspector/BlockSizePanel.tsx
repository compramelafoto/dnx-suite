"use client";

import { useEffect, useState } from "react";
import {
  ASPECT_PRESETS,
  canvasDpi,
  describeAspect,
  findAspectPreset,
  fitBoxToAspect,
  getBlockAspectLock,
  parseDimInput,
  pxFromUnit,
  sizeInUnit,
  type CanvasDimUnit,
  type TemplateV2Block,
  type TemplateV2Canvas,
  type TemplateV2EditorDispatch,
} from "@repo/template-editor-core";
import { cn } from "../primitives/cn";
import { setBlockSizeUnit, useBlockSizeUnit } from "../useBlockSizeUnit";
import { InspectorPanel } from "./InspectorPanel";

/** Lado mínimo de un bloque, en px del lienzo (el mismo piso que el estirado con el mouse). */
const MIN_SIDE_PX = 24;

const selectBase =
  "h-7 rounded-md border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1 text-xs text-[color:var(--te-ink)] outline-none focus:border-[color:var(--te-accent)] disabled:opacity-50";

/** Valores del desplegable de formato que no son un preset. */
const FREE = "libre";
const CUSTOM = "fijo";

const UNIT_OPTIONS: { value: CanvasDimUnit; label: string }[] = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "px", label: "px" },
];

/**
 * Tamaño del bloque en la unidad elegida y su proporción: muestra si el recuadro es 4:3, 1:1,
 * etc., ofrece los formatos de foto y redes en un desplegable, y un candado para que al
 * estirarlo no se deforme.
 */
export function BlockSizePanel({
  block,
  canvas,
  dispatch,
}: {
  block: TemplateV2Block;
  canvas: TemplateV2Canvas;
  dispatch: TemplateV2EditorDispatch;
}) {
  const unit = useBlockSizeUnit();
  const dpi = canvasDpi(canvas);
  const { width, height } = block.layout;
  const cfg = (block.configJson ?? {}) as Record<string, unknown>;
  const lock = getBlockAspectLock(cfg);
  const lockedLayout = Boolean(block.layout.locked);
  // En los textos la caja sigue al contenido; fijarle formato de foto no tiene sentido.
  const allowsAspect = block.type !== "TEXT" && block.type !== "VARIABLE_TEXT" && block.type !== "BACKGROUND";
  const current = findAspectPreset(width, height);
  const lockPreset = lock ? findAspectPreset(lock, 1) : null;

  function apply(layout: Partial<TemplateV2Block["layout"]>, configJson?: Record<string, unknown>) {
    dispatch({
      type: "updateBlock",
      payload: { blockId: block.id, patch: { layout, ...(configJson ? { configJson } : {}) } },
    });
  }

  /** Cambia un lado manteniendo el centro; con candado, el otro lado acompaña. */
  function commitSide(side: "width" | "height", valueInUnit: number) {
    const px = Math.max(MIN_SIDE_PX, pxFromUnit(valueInUnit, unit, dpi));
    let w = side === "width" ? px : width;
    let h = side === "height" ? px : height;
    if (lock) {
      if (side === "width") h = w / lock;
      else w = h * lock;
    }
    const cx = block.layout.x + width / 2;
    const cy = block.layout.y + height / 2;
    apply({ width: w, height: h, x: cx - w / 2, y: cy - h / 2 });
  }

  function withoutLock(): Record<string, unknown> {
    const rest = { ...cfg };
    delete rest.aspectLock;
    return rest;
  }

  function applyPreset(ratio: number) {
    const box = fitBoxToAspect({ x: block.layout.x, y: block.layout.y, width, height }, ratio, canvas);
    apply(box, { ...cfg, aspectLock: ratio });
  }

  function toggleLock() {
    if (lock) apply({}, withoutLock());
    else apply({}, { ...cfg, aspectLock: width / height });
  }

  const formatHint = lock
    ? "Proporción fijada: al estirar no se deforma."
    : "Elegí un formato para ajustar el recuadro y fijarlo. Mayús al estirar también mantiene la proporción.";

  return (
    <InspectorPanel title="Tamaño y proporción">
      <div className="flex items-center gap-1">
        <DimField
          label="An"
          title="Ancho"
          value={sizeInUnit(width, unit, dpi)}
          disabled={lockedLayout}
          onCommit={(v) => commitSide("width", v)}
        />
        <button
          type="button"
          onClick={toggleLock}
          disabled={lockedLayout || !allowsAspect}
          aria-pressed={lock !== null}
          title={
            !allowsAspect
              ? "Los textos ajustan su caja al contenido"
              : lock
                ? "Proporción fijada: al estirar no se deforma. Clic para liberarla."
                : "Fijar la proporción actual"
          }
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            lock
              ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]"
              : "border-[color:var(--te-line)] bg-[color:var(--te-surface)] text-[color:var(--te-ink-muted)] hover:text-[color:var(--te-ink)]"
          )}
        >
          <LockGlyph closed={lock !== null} />
        </button>
        <DimField
          label="Al"
          title="Alto"
          value={sizeInUnit(height, unit, dpi)}
          disabled={lockedLayout}
          onCommit={(v) => commitSide("height", v)}
        />
        <select
          aria-label="Unidad"
          title="Unidad"
          className={cn(selectBase, "w-14 shrink-0")}
          value={unit}
          onChange={(e) => setBlockSizeUnit(e.target.value as CanvasDimUnit)}
        >
          {UNIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        {allowsAspect ? (
          <select
            aria-label="Formato"
            title={formatHint}
            className={cn(selectBase, "min-w-0 flex-1")}
            disabled={lockedLayout}
            value={lock === null ? FREE : (lockPreset?.label ?? CUSTOM)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === FREE) apply({}, withoutLock());
              const preset = ASPECT_PRESETS.find((p) => p.label === v);
              if (preset) applyPreset(preset.ratio);
            }}
          >
            <option value={FREE}>Formato libre</option>
            {lock !== null && !lockPreset ? (
              <option value={CUSTOM}>Fijo en {describeAspect(lock, 1)}</option>
            ) : null}
            {ASPECT_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} · {p.hint}
              </option>
            ))}
          </select>
        ) : null}
        <span
          className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-[color:var(--te-ink-muted)]"
          title={current ? `Proporción: ${current.hint}` : "Proporción: no coincide con un formato habitual"}
        >
          {describeAspect(width, height)}
        </span>
      </div>
    </InspectorPanel>
  );
}

/** Campo numérico que confirma al salir o con Enter; Escape vuelve al valor actual. */
function DimField({
  label,
  title,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  title: string;
  value: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  const shown = value.toLocaleString("es-AR", { useGrouping: false });
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(shown);
  }, [shown, editing]);

  function commit() {
    setEditing(false);
    const n = parseDimInput(draft);
    if (n === null || n <= 0) {
      setDraft(shown);
      return;
    }
    if (n !== value) onCommit(n);
  }

  return (
    <label
      title={title}
      className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1.5 focus-within:border-[color:var(--te-accent)]"
    >
      <span className="shrink-0 text-[10px] font-medium text-[color:var(--te-ink-faint)]">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(shown);
            setEditing(false);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-label={title}
        className="w-full min-w-0 bg-transparent text-xs tabular-nums text-[color:var(--te-ink)] outline-none disabled:opacity-50"
      />
    </label>
  );
}

function LockGlyph({ closed }: { closed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      {closed ? <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /> : <path d="M5.5 7V5a2.5 2.5 0 0 1 4.9-.7" />}
    </svg>
  );
}
