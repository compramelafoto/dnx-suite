"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Button from "./primitives/Button";
import type { TemplateV2Canvas } from "@repo/template-editor-core";
import {
  formatDimForUnit,
  parseDimInput,
  pxFromUnit,
  type CanvasDimUnit,
  TEMPLATE_V2_EXPORT_DPI,
} from "@repo/template-editor-core";
import { cn } from "./primitives/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  canvas: TemplateV2Canvas;
  onApply: (next: Partial<TemplateV2Canvas>) => void;
};

const DPI = TEMPLATE_V2_EXPORT_DPI;

function clampDim(n: number) {
  if (!Number.isFinite(n)) return 1200;
  return Math.min(16000, Math.max(64, Math.round(n)));
}

export function CanvasSizeModal({ open, onClose, canvas, onApply }: Props) {
  const [mounted, setMounted] = useState(false);
  const [dimUnit, setDimUnit] = useState<CanvasDimUnit>("px");
  const [wPx, setWPx] = useState(canvas.width);
  const [hPx, setHPx] = useState(canvas.height);
  const [widthStr, setWidthStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [lockProportion, setLockProportion] = useState(false);
  /** ancho / alto; se fija al activar el candado */
  const [aspectRatio, setAspectRatio] = useState(1);
  const [safeMm, setSafeMm] = useState(
    canvas.safeAreaMm != null && Number.isFinite(canvas.safeAreaMm) ? String(canvas.safeAreaMm) : ""
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setWPx(canvas.width);
    setHPx(canvas.height);
    setWidthStr(formatDimForUnit(canvas.width, dimUnit, DPI));
    setHeightStr(formatDimForUnit(canvas.height, dimUnit, DPI));
    setLockProportion(false);
    setSafeMm(canvas.safeAreaMm != null && Number.isFinite(canvas.safeAreaMm) ? String(canvas.safeAreaMm) : "");
    // dimUnit no va en deps: al cambiar unidad solo reformateamos desde wPx/hPx en el <select>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canvas.width, canvas.height, canvas.safeAreaMm]);

  if (!open) return null;

  const inputClass =
    "w-full rounded-lg border border-[color:var(--te-line)] bg-white px-2.5 py-2 text-xs text-[color:var(--te-ink)] shadow-sm focus:border-[color:var(--te-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--te-accent-wash)]";

  const selectClass =
    "rounded-lg border border-[color:var(--te-line)] bg-white px-2.5 py-2 text-xs shadow-sm focus:border-[color:var(--te-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--te-accent-wash)]";

  function applyWidthFromString(s: string) {
    setWidthStr(s);
    const n = parseDimInput(s);
    if (n === null) return;
    const newW = clampDim(pxFromUnit(n, dimUnit, DPI));
    setWPx(newW);
    if (lockProportion && aspectRatio > 0) {
      const newH = clampDim(Math.round(newW / aspectRatio));
      setHPx(newH);
      setHeightStr(formatDimForUnit(newH, dimUnit, DPI));
    }
  }

  function applyHeightFromString(s: string) {
    setHeightStr(s);
    const n = parseDimInput(s);
    if (n === null) return;
    const newH = clampDim(pxFromUnit(n, dimUnit, DPI));
    setHPx(newH);
    if (lockProportion && aspectRatio > 0) {
      const newW = clampDim(Math.round(newH * aspectRatio));
      setWPx(newW);
      setWidthStr(formatDimForUnit(newW, dimUnit, DPI));
    }
  }

  function toggleProportionLock() {
    if (!lockProportion) {
      const r = hPx > 0 ? wPx / hPx : 1;
      setAspectRatio(r > 0 ? r : 1);
    }
    setLockProportion((v) => !v);
  }

  function submit() {
    const w = clampDim(wPx);
    const h = clampDim(hPx);
    const mmRaw = safeMm.trim() === "" ? undefined : Number(safeMm.replace(",", "."));
    const safeAreaMm =
      mmRaw !== undefined && Number.isFinite(mmRaw) && mmRaw >= 0 ? Math.min(500, Math.max(0, mmRaw)) : undefined;
    onApply({ width: w, height: h, safeAreaMm, dpi: DPI });
  }

  const unitSuffix =
    dimUnit === "px" ? "px" : dimUnit === "cm" ? "cm" : "mm";

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-size-title"
      onClick={onClose}
    >
      <div
        className="box-border mx-auto w-full max-w-4xl min-w-[min(100%,300px)] shrink-0 rounded-2xl border border-[color:var(--te-line)] bg-white px-6 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="canvas-size-title" className="text-sm font-semibold text-[color:var(--te-ink)]">
          Tamaño del lienzo
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
          El lienzo se guarda en <span className="font-medium text-[color:var(--te-ink)]">píxeles</span>. Las medidas en cm o mm se
          convierten con <span className="font-medium text-[color:var(--te-ink)]">{DPI} DPI</span> (resolución de referencia para
          exportación). El contenido existente conserva su posición respecto del origen (arriba-izquierda).
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-[color:var(--te-ink)]">Unidades</span>
            <select
              className={selectClass}
              value={dimUnit}
              onChange={(e) => {
                const u = e.target.value as CanvasDimUnit;
                setDimUnit(u);
                setWidthStr(formatDimForUnit(wPx, u, DPI));
                setHeightStr(formatDimForUnit(hPx, u, DPI));
              }}
            >
              <option value="px">Píxeles (px)</option>
              <option value="cm">Centímetros (cm)</option>
              <option value="mm">Milímetros (mm)</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[color:var(--te-ink)]">Ancho ({unitSuffix})</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={widthStr}
              onChange={(e) => applyWidthFromString(e.target.value)}
            />
          </label>

          <button
            type="button"
            title={
              lockProportion
                ? "Desvincular proporción (alto y ancho independientes)"
                : "Vincular proporción (como Photoshop: al cambiar un lado, el otro escala)"
            }
            aria-pressed={lockProportion}
            onClick={toggleProportionLock}
            className={cn(
              "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[color:var(--te-ink-muted)] transition-colors",
              lockProportion
                ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)] shadow-sm"
                : "border-[color:var(--te-line)] bg-white hover:border-[color:var(--te-line-strong)] hover:bg-[color:var(--te-chrome)]"
            )}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </button>

          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[color:var(--te-ink)]">Alto ({unitSuffix})</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={heightStr}
              onChange={(e) => applyHeightFromString(e.target.value)}
            />
          </label>
        </div>

        <p className="mt-1.5 text-[10px] text-[color:var(--te-ink-faint)]">
          {lockProportion ? (
            <>Proporción fijada: {(wPx / hPx).toFixed(4)} (ancho / alto).</>
          ) : (
            <>Activá el ícono de eslabón para mantener la proporción al editar ancho o alto.</>
          )}
        </p>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-medium text-[color:var(--te-ink)]">
            Zona segura (margen interior, mm)
          </span>
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Opcional — guía en el editor"
            value={safeMm}
            onChange={(e) => setSafeMm(e.target.value)}
          />
          <span className="mt-1 block text-[10px] text-[color:var(--te-ink-faint)]">
            Vacío = margen por defecto del editor (~5%). El valor se guarda en milímetros en el lienzo.
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={submit}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
