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
import { FieldLabel, InspectorPanel } from "./InspectorPanel";
import { SegmentedControl } from "./SegmentedControl";

/** Lado mínimo de un bloque, en px del lienzo (el mismo piso que el estirado con el mouse). */
const MIN_SIDE_PX = 24;

const UNIT_OPTIONS: { value: CanvasDimUnit; label: string }[] = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "px", label: "px" },
];

/**
 * Tamaño del bloque en la unidad elegida y su proporción: muestra si el recuadro es 4:3, 1:1,
 * etc., ofrece los formatos de foto y redes, y un candado para que al estirarlo no se deforme.
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

  const presetBtn =
    "rounded-md border px-1.5 py-1 text-[11px] font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <InspectorPanel title="Tamaño y proporción">
      <div className="flex items-end gap-2">
        <DimField
          label="Ancho"
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
            "mb-[3px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            lock
              ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]"
              : "border-[color:var(--te-line)] bg-white text-[color:var(--te-ink-muted)] hover:text-[color:var(--te-ink)]"
          )}
        >
          <LockGlyph closed={lock !== null} />
        </button>
        <DimField
          label="Alto"
          value={sizeInUnit(height, unit, dpi)}
          disabled={lockedLayout}
          onCommit={(v) => commitSide("height", v)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <SegmentedControl value={unit} onChange={setBlockSizeUnit} options={UNIT_OPTIONS} className="w-32" />
        <span
          className="text-[11px] text-[color:var(--te-ink-muted)]"
          title={current ? current.hint : "No coincide con un formato habitual"}
        >
          Proporción{" "}
          <span className="font-semibold tabular-nums text-[color:var(--te-ink)]">{describeAspect(width, height)}</span>
        </span>
      </div>

      {allowsAspect ? (
        <div>
          <FieldLabel>Formato</FieldLabel>
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              disabled={lockedLayout}
              onClick={() => apply({}, withoutLock())}
              title="Sin proporción fija: se estira libre"
              className={cn(
                presetBtn,
                lock === null
                  ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]"
                  : "border-[color:var(--te-line)] bg-white text-[color:var(--te-ink)] hover:border-[color:var(--te-accent)]"
              )}
            >
              Libre
            </button>
            {ASPECT_PRESETS.map((p) => {
              const active = lockPreset?.label === p.label;
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={lockedLayout}
                  onClick={() => applyPreset(p.ratio)}
                  title={p.hint}
                  className={cn(
                    presetBtn,
                    active
                      ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]"
                      : "border-[color:var(--te-line)] bg-white text-[color:var(--te-ink)] hover:border-[color:var(--te-accent)]"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--te-ink-faint)]">
            {lock
              ? `Fijado en ${lockPreset?.label ?? describeAspect(lock, 1)}: al estirar desde la esquina no se deforma.`
              : "Elegí un formato para ajustar el recuadro y fijarlo. Mayús al estirar también mantiene la proporción."}
          </p>
        </div>
      ) : null}
    </InspectorPanel>
  );
}

/** Campo numérico que confirma al salir o con Enter; Escape vuelve al valor actual. */
function DimField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
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
    <label className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
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
        className="h-8 w-full rounded-md border border-[color:var(--te-line)] bg-white px-2 text-xs tabular-nums text-[color:var(--te-ink)] outline-none focus:border-[color:var(--te-accent)] disabled:opacity-50"
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
