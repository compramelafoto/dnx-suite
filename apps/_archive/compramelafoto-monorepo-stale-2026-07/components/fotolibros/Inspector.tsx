"use client";

import { useState, useRef, useEffect } from "react";
import type { FrameItem, FrameShape, TextItem } from "./types";
import Card from "@/components/ui/Card";
import ImageFramePreview from "./ImageFramePreview";
import { getRotationFillZoom } from "./imageCrop";
import {
  POLAROID_FONTS,
  getPolaroidFontFamily,
  normalizePolaroidFontValue,
  POLAROID_FONT_FALLBACK,
} from "@/components/polaroid/fonts";

/** Fuentes iguales que en el diseñador de polaroids; value = clave interna (ej. "inter", "playfair"). */
const FONTS = POLAROID_FONTS.map((f) => ({
  value: f.value,
  label: f.label,
}));

/** Valor actual de fontFamily → normalizado a clave ("inter", "playfair", etc.). */
function toFontKey(fontFamily?: string | null): string {
  if (!fontFamily) return "inter";
  return normalizePolaroidFontValue(fontFamily);
}

type FontOption = { value: string; label: string };

function FontSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: FontOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const current = options.find((f) => f.value === value) ?? options[0];
  const fontCss = getPolaroidFontFamily(current.value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-[#e5e7eb] bg-white px-2 py-2.5 text-sm text-left hover:border-[#d1d5db]"
        style={{ fontFamily: `${fontCss}, ${POLAROID_FONT_FALLBACK}` }}
      >
        <span title={current.label}>{current.label}</span>
        <span className="text-[#6b7280] text-xs ml-1 shrink-0">▼</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-[#e5e7eb] bg-white shadow-lg py-1">
          {options.map((f) => {
            const css = getPolaroidFontFamily(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  onChange(f.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#f9fafb] flex items-center gap-2 ${
                  f.value === value ? "bg-[#fff7ee] text-[#c27b3d]" : "text-[#1a1a1a]"
                }`}
                style={{ fontFamily: `${css}, ${POLAROID_FONT_FALLBACK}` }}
              >
                <span className="flex-1 truncate">{f.label}</span>
                <span className="text-base text-[#6b7280] shrink-0" style={{ fontFamily: `${css}, ${POLAROID_FONT_FALLBACK}` }} title="Vista previa">Aa</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type InspectorProps = {
  item: FrameItem | TextItem | null;
  onChange: (next: Partial<FrameItem> | Partial<TextItem>) => void;
  /** URL de la imagen cuando el ítem es un recuadro con imagen (para la vista previa) */
  imageUrl?: string | null;
  /** Si true, muestra controles de posición y tamaño (x, y, width, height para frames; x, y para textos) */
  showPositionSizeControls?: boolean;
  /** Factor para mostrar valores en cm (px * pxToCm = cm). Si no se pasa, se muestran en px. */
  pxToCm?: number;
  /** Si true, muestra selector de forma (círculo, triángulo, corazón, etc.) — solo en diseñador de doble clic */
  showShapeSelector?: boolean;
  /** Modo simplificado: solo zoom y posición de la imagen. Sin recortar, rotar, ni controles de marco. */
  simpleMode?: boolean;
};

function ShapeIconRect({ className }: { className?: string }) {
  return (
    <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
    </svg>
  );
}
function ShapeIconCircle({ className }: { className?: string }) {
  return (
    <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function ShapeIconTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  );
}
function ShapeIconPentagon({ className }: { className?: string }) {
  return (
    <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l9 6.5v7L12 22l-9-6.5v-7L12 2z" />
    </svg>
  );
}
function ShapeIconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

const SHAPE_OPTIONS: { shape: FrameShape; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { shape: "rect", label: "Rectángulo", Icon: ShapeIconRect },
  { shape: "circle", label: "Círculo", Icon: ShapeIconCircle },
  { shape: "triangle", label: "Triángulo", Icon: ShapeIconTriangle },
  { shape: "pentagon", label: "Pentágono", Icon: ShapeIconPentagon },
  { shape: "heart", label: "Corazón", Icon: ShapeIconHeart },
];

export default function Inspector({ item, onChange, imageUrl, showPositionSizeControls = false, pxToCm, showShapeSelector = false, simpleMode = false }: InspectorProps) {
  if (!item) {
    return (
      <Card className="p-4">
        <div className="text-sm text-[#6b7280]">
          Seleccioná un recuadro para editar la imagen, o un texto para editarlo.
        </div>
      </Card>
    );
  }

  if (item.type === "text") {
    const textItem = item as TextItem;
    const unit = pxToCm != null ? "cm" : "px";
    const toDisplay = (v: number) => (pxToCm != null ? (v * pxToCm).toFixed(2) : Math.round(v).toString());
    const fromDisplay = (s: string) => (pxToCm != null ? Number(s) / pxToCm : Number(s));

    return (
      <Card className="p-4 space-y-4">
        <div className="text-sm font-medium text-[#1a1a1a]">Texto</div>
        {showPositionSizeControls && (
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#e5e7eb]">
            <div>
              <label className="text-xs text-[#6b7280]">X ({unit})</label>
              <input
                type="number"
                step={pxToCm != null ? 0.1 : 1}
                value={toDisplay(textItem.x)}
                onChange={(e) => onChange({ x: fromDisplay(e.target.value) })}
                className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#6b7280]">Y ({unit})</label>
              <input
                type="number"
                step={pxToCm != null ? 0.1 : 1}
                value={toDisplay(textItem.y)}
                onChange={(e) => onChange({ y: fromDisplay(e.target.value) })}
                className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-xs text-[#6b7280]">Tamaño (pt)</label>
            <input
              type="number"
              min="8"
              max="500"
              value={textItem.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) || 16 })}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[#6b7280]">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={textItem.fill}
                onChange={(e) => onChange({ fill: e.target.value })}
                className="h-8 w-10 rounded border border-[#e5e7eb] cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={textItem.fill}
                onChange={(e) => onChange({ fill: e.target.value })}
                className="flex-1 min-w-0 rounded-md border border-[#e5e7eb] px-2 py-1 text-sm font-mono"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Fuente</label>
          <FontSelect
            value={toFontKey(textItem.fontFamily)}
            options={FONTS}
            onChange={(value) => onChange({ fontFamily: value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ bold: !textItem.bold })}
            className={`rounded-md border px-2 py-1 text-xs ${textItem.bold ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb]"}`}
            style={{ fontWeight: 700 }}
          >
            Negrita
          </button>
          <button
            type="button"
            onClick={() => onChange({ italic: !textItem.italic })}
            className={`rounded-md border px-2 py-1 text-xs ${textItem.italic ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb]"}`}
            style={{ fontStyle: "italic" }}
          >
            Cursiva
          </button>
          <button
            type="button"
            onClick={() => onChange({ underline: !textItem.underline })}
            className={`rounded-md border px-2 py-1 text-xs ${textItem.underline ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb]"}`}
            style={{ textDecoration: "underline" }}
          >
            Subrayado
          </button>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Alineación</label>
          <select
            value={textItem.align}
            onChange={(e) => onChange({ align: e.target.value as TextItem["align"] })}
            className="w-full rounded-md border border-[#e5e7eb] px-2 py-2 text-sm"
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5" title="Interletrado (espacio entre letras)">
              <svg className="w-4 h-4 text-[#6b7280] shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M3 2v12h1.5V2H3zm7 0v12h1.5V2H10z" />
              </svg>
              <input
                type="range"
                min="-5"
                max="50"
                step="1"
                value={textItem.letterSpacing ?? 0}
                onChange={(e) => onChange({ letterSpacing: Number(e.target.value) || 0 })}
                className="flex-1 min-w-0"
              />
              <span className="text-[10px] text-[#6b7280] w-6 text-right shrink-0">{textItem.letterSpacing ?? 0}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5" title="Interlineado (espacio entre líneas)">
              <svg className="w-4 h-4 text-[#6b7280] shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M2 3h12v1H2V3zm0 5h12v1H2V8zm0 5h8v1H2v-1z" />
              </svg>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={textItem.lineHeight ?? 1}
                onChange={(e) => onChange({ lineHeight: Math.max(0.5, Number(e.target.value) || 1) })}
                className="flex-1 min-w-0"
              />
              <span className="text-[10px] text-[#6b7280] w-6 text-right shrink-0">{(textItem.lineHeight ?? 1).toFixed(1)}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const frameItem = item as FrameItem;
  const imageRotation = frameItem.imageRotation ?? 0;
  const unit = pxToCm != null ? "cm" : "px";
  const toDisplay = (v: number) => (pxToCm != null ? (v * pxToCm).toFixed(2) : Math.round(v).toString());
  const fromDisplay = (s: string) => (pxToCm != null ? Number(s) / pxToCm : Number(s));

  return (
    <Card className="p-4 space-y-4">
      <div className="text-sm font-medium text-[#1a1a1a]">Imagen en el recuadro</div>
      {showShapeSelector && !simpleMode && (
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Forma del recuadro</label>
          <div className="flex flex-wrap gap-2">
            {SHAPE_OPTIONS.map(({ shape, label, Icon }) => (
              <button
                key={shape}
                type="button"
                title={label}
                onClick={() => onChange({ shape })}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-colors ${
                  (frameItem.shape ?? "rect") === shape
                    ? "border-[#c27b3d] bg-[#fff7ee] text-[#c27b3d]"
                    : "border-[#e5e7eb] hover:border-[#d1d5db] text-[#6b7280]"
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>
      )}
      {showPositionSizeControls && !simpleMode && (
        <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#e5e7eb]">
          <div>
            <label className="text-xs text-[#6b7280]">X ({unit})</label>
            <input
              type="number"
              step={pxToCm != null ? 0.1 : 1}
              value={toDisplay(frameItem.x)}
              onChange={(e) => onChange({ x: fromDisplay(e.target.value) })}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#6b7280]">Y ({unit})</label>
            <input
              type="number"
              step={pxToCm != null ? 0.1 : 1}
              value={toDisplay(frameItem.y)}
              onChange={(e) => onChange({ y: fromDisplay(e.target.value) })}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#6b7280]">Ancho ({unit})</label>
            <input
              type="number"
              step={pxToCm != null ? 0.1 : 1}
              min={pxToCm != null ? 0.5 : 20}
              value={toDisplay(frameItem.width)}
              onChange={(e) => {
                const v = fromDisplay(e.target.value);
                onChange({ width: Math.max(20, Number.isNaN(v) ? frameItem.width : v) });
              }}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#6b7280]">Alto ({unit})</label>
            <input
              type="number"
              step={pxToCm != null ? 0.1 : 1}
              min={pxToCm != null ? 0.5 : 20}
              value={toDisplay(frameItem.height)}
              onChange={(e) => {
                const v = fromDisplay(e.target.value);
                onChange({ height: Math.max(20, Number.isNaN(v) ? frameItem.height : v) });
              }}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-[#6b7280]">Rotación (°)</label>
            <input
              type="number"
              step={1}
              value={Math.round(frameItem.rotation ?? 0)}
              onChange={(e) => onChange({ rotation: Number(e.target.value) })}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}
      {!simpleMode && (
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Ajuste</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ fitMode: "cover" })}
              title="Recortar (Cover) — La imagen llena el recuadro, se recorta si hace falta"
              className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-2.5 transition-colors ${
                frameItem.fitMode === "cover"
                  ? "border-[#c27b3d] bg-[#fff7ee] text-[#c27b3d]"
                  : "border-[#e5e7eb] bg-white hover:border-[#d1d5db] text-[#6b7280]"
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="3" y="3" width="18" height="18" rx="1" />
                <path d="M3 3v6h6M21 3v6h-6M3 21v-6h6M21 21v-6h-6" strokeWidth="1.5" opacity="0.8" />
              </svg>
              <span className="text-xs font-medium">Recortar</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ fitMode: "contain" })}
              title="Encajar (Contain) — La imagen se ve completa dentro del recuadro"
              className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-2.5 transition-colors ${
                frameItem.fitMode === "contain"
                  ? "border-[#c27b3d] bg-[#fff7ee] text-[#c27b3d]"
                  : "border-[#e5e7eb] bg-white hover:border-[#d1d5db] text-[#6b7280]"
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="2" y="2" width="20" height="20" rx="1" />
                <rect x="6" y="6" width="12" height="12" rx="0.5" strokeWidth="1.5" />
              </svg>
              <span className="text-xs font-medium">Encajar</span>
            </button>
          </div>
        </div>
      )}
      {imageUrl && (
        <>
          <p className="text-xs text-[#6b7280] -mt-1">
            En el canvas: <kbd className="px-1 py-0.5 rounded bg-[#e5e7eb] text-[10px]">Alt</kbd> + arrastrar para re-encuadrar.
          </p>
          <ImageFramePreview
            imageUrl={imageUrl}
            frame={frameItem}
            onChange={onChange}
            allowRotate={true}
          />
        </>
      )}
      <div className="border-t border-[#e5e7eb] pt-3 space-y-3">
        <p className="text-sm font-medium text-[#1a1a1a]">Diseño</p>
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Escala</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={frameItem.imageZoom}
              onChange={(e) => onChange({ imageZoom: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs text-[#6b7280] min-w-[3rem]">{Math.round((frameItem.imageZoom ?? 1) * 100)}%</span>
            <button
              type="button"
              onClick={() => onChange({ imageZoom: 1 })}
              className="text-[#6b7280] hover:text-[#1a1a1a] p-0.5"
              title="Restablecer"
            >
              {"✕"}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Ángulo</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="-15"
              max="15"
              step="0.5"
              value={imageRotation}
              onChange={(e) => {
                const newRot = Number(e.target.value);
                const fillZoom = getRotationFillZoom(newRot);
                onChange({ imageRotation: newRot, imageZoom: fillZoom });
              }}
              className="flex-1"
            />
            <span className="text-xs text-[#6b7280] min-w-[3rem]">{Number(imageRotation).toFixed(1)}°</span>
            <button
              type="button"
              onClick={() => onChange({ imageRotation: 0, imageZoom: 1 })}
              className="text-[#6b7280] hover:text-[#1a1a1a] p-0.5"
              title="Restablecer"
            >
              {"✕"}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Opacidad</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={frameItem.imageOpacity ?? 1}
              onChange={(e) => onChange({ imageOpacity: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs text-[#6b7280] min-w-[3rem]">{Math.round((frameItem.imageOpacity ?? 1) * 100)}%</span>
            <button
              type="button"
              onClick={() => onChange({ imageOpacity: 1 })}
              className="text-[#6b7280] hover:text-[#1a1a1a] p-0.5"
              title="Restablecer"
            >
              {"✕"}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[#6b7280]">Borde</label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={frameItem.borderWidth ?? 0}
              onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
              className="flex-1 min-w-0"
            />
            <span className="text-xs text-[#6b7280] min-w-[4rem]">{(frameItem.borderWidth ?? 0).toFixed(0)} px</span>
            <input
              type="color"
              value={frameItem.borderColor ?? "#000000"}
              onChange={(e) => onChange({ borderColor: e.target.value })}
              className="w-8 h-8 rounded border border-[#e5e7eb] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => onChange({ borderWidth: 0 })}
              className="text-[#6b7280] hover:text-[#1a1a1a] p-0.5"
              title="Restablecer"
            >
              {"✕"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

